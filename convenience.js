const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;

/**
 * getSettings:
 * @schema: (optional): the GSettings schema id
 *
 * Builds and return a GSettings schema for @schema, using schema files
 * in extensionsdir/schemas. If @schema is not provided, it is taken from
 * metadata['settings-schema'].
 */
function getSettings(schema) {
    let extension = ExtensionUtils.getCurrentExtension();

    schema = schema || extension.metadata['settings-schema'];

    const GioSSS = Gio.SettingsSchemaSource;

    // Check if this extension was built with "make zip-file", and thus
    // has the schema files in a subfolder
    // otherwise assume that extension has been installed in the
    // same prefix as gnome-shell (and therefore schemas are available
    // in the standard folders)
    let schemaDir = extension.dir.get_child('schemas');
    let schemaSource;
    if (schemaDir.query_exists(null))
        schemaSource = GioSSS.new_from_directory(schemaDir.get_path(),
                                                 GioSSS.get_default(),
                                                 false);
    else
        schemaSource = GioSSS.get_default();

    let schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj)
        throw new Error('Schema ' + schema + ' could not be found for extension '
                        + extension.metadata.uuid + '. Please check your installation.');

    return new Gio.Settings({
        settings_schema: schemaObj
    });
}

function fuzzySet (arr, useLevenshtein, gramSizeLower, gramSizeUpper) {
  var fuzzyset = {

  }

  // default options
  arr = arr || []
  fuzzyset.gramSizeLower = gramSizeLower || 2
  fuzzyset.gramSizeUpper = gramSizeUpper || 3
  fuzzyset.useLevenshtein = (typeof useLevenshtein !== 'boolean') ? true : useLevenshtein

  // define all the object functions and attributes
  fuzzyset.exactSet = {}
  fuzzyset.matchDict = {}
  fuzzyset.items = {}

  // helper functions
  var levenshtein = function (str1, str2) {
    var current = []; var prev; var value

    for (var i = 0; i <= str2.length; i++) {
      for (var j = 0; j <= str1.length; j++) {
        if (i && j) {
          if (str1.charAt(j - 1) === str2.charAt(i - 1)) { value = prev } else { value = Math.min(current[j], current[j - 1], prev) + 1 }
        } else { value = i + j }

        prev = current[j]
        current[j] = value
      }
    }

    return current.pop()
  }

  // return an edit distance from 0 to 1
  var _distance = function (str1, str2) {
    if (str1 === null && str2 === null) throw 'Trying to compare two null values'
    if (str1 === null || str2 === null) return 0
    str1 = String(str1); str2 = String(str2)

    var distance = levenshtein(str1, str2)
    if (str1.length > str2.length) {
      return 1 - distance / str1.length
    } else {
      return 1 - distance / str2.length
    }
  }
  var _nonWordRe = /[^a-zA-Z0-9\u00C0-\u00FF, ]+/g

  var _iterateGrams = function (value, gramSize) {
    gramSize = gramSize || 2
    var simplified = '-' + value.toLowerCase().replace(_nonWordRe, '') + '-'

    var lenDiff = gramSize - simplified.length

    var results = []
    if (lenDiff > 0) {
      for (var i = 0; i < lenDiff; ++i) {
        simplified += '-'
      }
    }
    for (var i = 0; i < simplified.length - gramSize + 1; ++i) {
      results.push(simplified.slice(i, i + gramSize))
    }
    return results
  }

  var _gramCounter = function (value, gramSize) {
    // return an object where key=gram, value=number of occurrences
    gramSize = gramSize || 2
    var result = {}

    var grams = _iterateGrams(value, gramSize)

    var i = 0
    for (i; i < grams.length; ++i) {
      if (grams[i] in result) {
        result[grams[i]] += 1
      } else {
        result[grams[i]] = 1
      }
    }
    return result
  }

  // the main functions
  fuzzyset.get = function (value, defaultValue, minMatchScore) {
    // check for value in set, returning defaultValue or null if none found
    if (minMatchScore === undefined) {
      minMatchScore = 0.33
    }
    var result = this._get(value, minMatchScore)
    if (!result && typeof defaultValue !== 'undefined') {
      return defaultValue
    }
    return result
  }

  fuzzyset._get = function (value, minMatchScore) {
    var normalizedValue = this._normalizeStr(value)

    var result = this.exactSet[normalizedValue]
    if (result) {
      return [[1, result]]
    }

    var results = []
    // start with high gram size and if there are no results, go to lower gram sizes
    for (var gramSize = this.gramSizeUpper; gramSize >= this.gramSizeLower; --gramSize) {
      results = this.__get(value, gramSize, minMatchScore)
      if (results && results.length > 0) {
        return results
      }
    }
    return null
  }

  fuzzyset.__get = function (value, gramSize, minMatchScore) {
    var normalizedValue = this._normalizeStr(value)

    var matches = {}

    var gramCounts = _gramCounter(normalizedValue, gramSize)

    var items = this.items[gramSize]

    var sumOfSquareGramCounts = 0

    var gram

    var gramCount

    var i

    var index

    var otherGramCount

    for (gram in gramCounts) {
      gramCount = gramCounts[gram]
      sumOfSquareGramCounts += Math.pow(gramCount, 2)
      if (gram in this.matchDict) {
        for (i = 0; i < this.matchDict[gram].length; ++i) {
          index = this.matchDict[gram][i][0]
          otherGramCount = this.matchDict[gram][i][1]
          if (index in matches) {
            matches[index] += gramCount * otherGramCount
          } else {
            matches[index] = gramCount * otherGramCount
          }
        }
      }
    }

    function isEmptyObject (obj) {
      for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) { return false }
      }
      return true
    }

    if (isEmptyObject(matches)) {
      return null
    }

    var vectorNormal = Math.sqrt(sumOfSquareGramCounts)

    var results = []

    var matchScore
    // build a results list of [score, str]
    for (var matchIndex in matches) {
      matchScore = matches[matchIndex]
      results.push([matchScore / (vectorNormal * items[matchIndex][0]), items[matchIndex][1]])
    }
    var sortDescending = function (a, b) {
      if (a[0] < b[0]) {
        return 1
      } else if (a[0] > b[0]) {
        return -1
      } else {
        return 0
      }
    }
    results.sort(sortDescending)
    if (this.useLevenshtein) {
      var newResults = []

      var endIndex = Math.min(50, results.length)
      // truncate somewhat arbitrarily to 50
      for (var i = 0; i < endIndex; ++i) {
        newResults.push([_distance(results[i][1], normalizedValue), results[i][1]])
      }
      results = newResults
      results.sort(sortDescending)
    }
    var newResults = []
    results.forEach(function (scoreWordPair) {
      if (scoreWordPair[0] >= minMatchScore) {
        newResults.push([scoreWordPair[0], this.exactSet[scoreWordPair[1]]])
      }
    }.bind(this))
    return newResults
  }

  fuzzyset.add = function (value) {
    var normalizedValue = this._normalizeStr(value)
    if (normalizedValue in this.exactSet) {
      return false
    }

    var i = this.gramSizeLower
    for (i; i < this.gramSizeUpper + 1; ++i) {
      this._add(value, i)
    }
  }

  fuzzyset._add = function (value, gramSize) {
    var normalizedValue = this._normalizeStr(value)

    var items = this.items[gramSize] || []

    var index = items.length

    items.push(0)
    var gramCounts = _gramCounter(normalizedValue, gramSize)

    var sumOfSquareGramCounts = 0

    var gram; var gramCount
    for (gram in gramCounts) {
      gramCount = gramCounts[gram]
      sumOfSquareGramCounts += Math.pow(gramCount, 2)
      if (gram in this.matchDict) {
        this.matchDict[gram].push([index, gramCount])
      } else {
        this.matchDict[gram] = [[index, gramCount]]
      }
    }
    var vectorNormal = Math.sqrt(sumOfSquareGramCounts)
    items[index] = [vectorNormal, normalizedValue]
    this.items[gramSize] = items
    this.exactSet[normalizedValue] = value
  }

  fuzzyset._normalizeStr = function (str) {
    if (Object.prototype.toString.call(str) !== '[object String]') throw 'Must use a string as argument to FuzzySet functions'
    return str.toLowerCase()
  }

  // return length of items in set
  fuzzyset.length = function () {
    var count = 0

    var prop
    for (prop in this.exactSet) {
      if (this.exactSet.hasOwnProperty(prop)) {
        count += 1
      }
    }
    return count
  }

  // return is set is empty
  fuzzyset.isEmpty = function () {
    for (var prop in this.exactSet) {
      if (this.exactSet.hasOwnProperty(prop)) {
        return false
      }
    }
    return true
  }

  // return list of values loaded into set
  fuzzyset.values = function () {
    var values = []

    var prop
    for (prop in this.exactSet) {
      if (this.exactSet.hasOwnProperty(prop)) {
        values.push(this.exactSet[prop])
      }
    }
    return values
  }

  // initialization
  var i = fuzzyset.gramSizeLower
  for (i; i < fuzzyset.gramSizeUpper + 1; ++i) {
    fuzzyset.items[i] = []
  }
  // add all the items to the set
  for (i = 0; i < arr.length; ++i) {
    fuzzyset.add(arr[i])
  }

  return fuzzyset
}
