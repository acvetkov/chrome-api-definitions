var webidl = require("webidl2");

function parse (string) {
  return webidl.parse(cleanWebIDL(string));
}
exports.parse = parse;

/**
 * Blink WebIDL has a few differences compared to standard WebIDL.
 * This mostly just parses them out as we don't need them for this case.
 *
 * Dirty as hell.
 */
function cleanWebIDL (string) {
  var chunks = string.split("\n").filter(filterEmpty);
  var validChunks = [];
  var IN_ENUM = false;
  var chunk;

  for (var i = 0; i < chunks.length; i++) {
    chunk = chunks[i];

    // Skip if its the beginning or end of the namespace wrapper
    if (isNamespaceWrapper(chunk, i, chunks.length)) {
      continue;
    }

    // "any" types cannot be nullable.
    chunk = fixNullableAny(chunk);

    // Filter out extra [attributes]
    chunk = fixExtraAttrs(chunk);

    chunk = fixUnquotedEnums(chunk);

    validChunks.push(chunk);
  }

  // enum values must be quoted.
  function fixUnquotedEnums(chunk) {
    if (/\};/.test(chunk)) {
      IN_ENUM = false;
    }

    if (IN_ENUM) {
      // This handles the scenario where there is several enum values on one line
      // or just one per line.
      chunk = chunk.replace(/(\w+)/g, "\"$1\"");
    }

    // Is this the start of an enum
    if (/enum\s(\w+)\s\{/.test(chunk)) {
      IN_ENUM = true;

      // If this is the start of enum, also handle where the entire enum is on one line
      // Like: "enum Filename {uniquify, overwrite, prompt};"
      if (/\};/.test(chunk)) {
        // This is unbelievably terrible
        var list = chunk.match(/\{(.*)\}/)[1];
        var quotedList = list.replace(/(\w+)/g, "\"$1\"");
        chunk = chunk.replace(list, quotedList);
      }
    }

    return chunk;
  }


  return validChunks.join("\n");
}

function filterEmpty (string) {
  return string.length > 0 && string[0] !== "\n";
}

/**
 * "any" types cannot be nullable. Get rid of the "?".
 */
function fixNullableAny (line) {
  if (/\sany\?\s/.test(line)) {
    line = line.replace(/\sany\?\s/, " any ");
  }
  return line;
}

/**
 * Blink has extra attributes that webidl2 can't parse.
 * We aren't using them now, and maybe never, so just get rid of them.
 */
function fixExtraAttrs (line) {
  // Filter out extra attributes like [nocompile], [inline_doc], etc.
  if (/\[[\w_]+\]/.test(line)) {
    line = line.replace(/\[[\w_]+\s?]/g, "");
  }
  return line;
}

function isNamespaceWrapper (line, lineNo, totalLines) {
  // First strip the namespace struct, as the webidl2 doesn't parse that
  // (and I don't think that's a standard webidl instruction?)
  return line.indexOf("namespace") === 0 || lineNo === totalLines - 1;
}
