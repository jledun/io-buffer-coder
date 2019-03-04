'use strict';

const util = require('util');
const fs = require('fs');
const stat = util.promisify(fs.stat);
const path = require('path'); 
// const Buffer = require('buffer');
const typeDefinitions = require('./type-definitions.json');

const getFileDescription = (bufferDescriptionFilePath) => {
  return new Promise(async (resolve, reject) => {
    if (!bufferDescriptionFilePath) return reject(new Error(`Description file path is not defined.`));
    const p = (!path.isAbsolute(bufferDescriptionFilePath)) ?
      path.parse(path.resolve(__dirname, bufferDescriptionFilePath)) :
      path.parse(bufferDescriptionFilePath);
    try{
      const bdfStat = await stat(path.format(p));
      if (!bdfStat.isFile()) return reject(`${bufferDescriptionFilePath} is not a regular file.`);
      return resolve(require(path.format(p)));
    }catch(e) {
      return reject(e);
    }
  });
}

const flattenBDF = (bdf) => {
  if (!bdf) throw new Error(`Buffer description file is empty.`);
  if (!Array.isArray(bdf)) throw new Error(`Description file must be an array.`);
  let tmp = [];
  bdf.forEach(field => {
    tmp = tmp.concat(
      (field.hasOwnProperty('properties')) ? flattenBDF(field.properties) : 
      (field.hasOwnProperty('array')) ? 
        field.array.flatMap(
          arrayItem => flattenBDF(arrayItem)
        ) :
      field
    );
  });
  return tmp;
}

const getBDFByteLength = bdf => {
  const lastDef = flattenBDF(bdf).pop();
  return lastDef.offset + getFieldLength(lastDef);
}

const getReadFunction = (plctype, options) => {
  return (plctype.buftype.indexOf('toString') > -1) ?
    plctype.buftype :
    "".concat(
      "read",
      getTypeFunction(plctype, options)
    );
}

const getWriteFunction = (plctype, options) => {
  return "".concat(
    "write",
    getTypeFunction(plctype, options)
  );
}

const getTypeField = (plctype) => {
  const fieldtype = plctype.type.replace(/ARRAY OF /gi, "");
  return typeDefinitions.find(typedef => typedef.plctype === fieldtype);
}

const getTypeFunction = (plctype, options) => {
  return (plctype.buftype.indexOf("8") > -1) ?
    "".concat(
      getTypeField(plctype).buftype
    ) :
    "".concat(
      getTypeField(plctype).buftype,
      options.endianness
    );
}

const getFieldLength = (plctype) => {
  const typeDef = getTypeField(plctype);
  return (plctype.type.indexOf('ARRAY') > -1) ?
    plctype.length * typeDef.length :
    (plctype.length) ? plctype.length : typeDef.length;
}

const checkTypeField = (plctype) => {
  if (!plctype.hasOwnProperty('name') || plctype.name === "") throw new Error(`missing or empty name`, plctype);
  if (!plctype.hasOwnProperty('type') || plctype.type === "") throw new Error(`missing or empty type`, plctype);
  if (!plctype.hasOwnProperty('offset')) throw new Error(`missing offset`, plctype);
  if (typeof getTypeField(plctype) === "undefined") throw new Error(`Type does not exist`, plctype);
  if (plctype.type.indexOf('BOOL') > -1 && !plctype.hasOwnProperty('bitnumber')) throw new Error(`missing 'bitnumber' field`, plctype);
  if (plctype.type.indexOf('BOOL') > -1 && (plctype.bitnumber < 0 || plctype.bitnumber > 15)) throw new Error(`wrong 'bitnumber', it should be between 0 and 15`, plctype);
  if (plctype.type.indexOf('STRING') > -1 && (!plctype.hasOwnProperty('length') || plctype.length <= 0)) throw new Error(`missing or null length`, plctype);
  if (plctype.type.indexOf('ARRAY') > -1 && (!plctype.hasOwnProperty('length') || plctype.length <= 0)) throw new Error(`missing or null length`, plctype);
  if (plctype.type.indexOf('ARRAY') > -1 && plctype.type.indexOf('STRING') > -1) throw new Error(`ARRAY OF STRING or ARRAY OF S7STRING are not implemented yet :-(`, plctype);
  return true;
}

const checkBDFTypes = (bdf) => {
  let tmp = true;
  const flattened = flattenBDF(bdf);
  for (let i = 0; i < flattened.length; i++) {
    if (flattened[i].hasOwnProperty('properties')) {
      if (!Array.isArray(flattened[i].properties)) throw new Error(`Bad definition file : 'properties (${flattened[i].name})' must provide an array of properties.`);
      tmp = tmp && checkBDFTypes(flattened[i].properties);

    }else if (flattened[i].hasOwnProperty('array')) {
      if (!Array.isArray(flattened[i].array)) throw new Error(`Bad definition file : 'array (${flattened[i].name})' must provide an array.`);
      flattened[i].array.forEach(arrBdf => {
        tmp = tmp && checkBDFTypes(arrBDF);
      });

    }else{
      tmp = tmp && checkTypeField(flattened[i]);
    }
    if (!tmp) return tmp;
  }
  return tmp;
}

const checkData = (data, bdf) => {
  // check if data respects the definition file structure
  if (data === null || data === undefined) throw new Error(`Nothing to encode`);
  if (typeof data !== "object") throw new Error(`data must be an object`);
}

const checkBuffer = (buffer, bdf) => {
  // check buffer
  if (buffer === null || buffer === undefined) throw new Error(`Nothing to decode`);
  if (!Buffer.isBuffer(buffer)) throw new Error(`buffer is not a Buffer`);
  const totalLength = getBDFByteLength(bdf);
  if (buffer.length !== totalLength) throw new Error(`buffer length is not what it should be.`);
}

const init = (defPath) => {
  return new Promise(async (resolve, reject) => {
    try{
      const bdf = (typeof defPath === "string") ? 
        await getFileDescription(defPath) : 
        (Array.isArray(defPath)) ? [...defPath] : null;
      if (!bdf) throw new Error(`The first parameter must be a string or an array.`);
      checkBDFTypes(bdf);
      return resolve(bdf);
    }catch(e){
      return reject(e);
    }
  });
}

const getBitNumber = (bn) => {
  if (bn < 0 || bn > 15) throw new Error(`wrong bit number`, field);
  const bitNumbers = [0x1, 0x2, 0x4, 0x8, 0x10, 0x20, 0x40, 0x80, 0x100, 0x200, 0x400, 0x800, 0x1000, 0x2000, 0x4000, 0x8000];
  return bitNumbers[bn];
}

const readFieldFromBuffer = (buffer, field, options) => {
  const tmp = {...getTypeField(field), ...field};
  switch(tmp.plctype) {
    case "CHAR":
    case "STRING":
      return buffer[getReadFunction(tmp, options)]('ascii', tmp.offset, tmp.offset + tmp.length);

    case "S7STRING":
      let offset = tmp.offset;
      let stringObject = {};
      stringObject.maxlength = buffer[getReadFunction(tmp.buftype.maxlength, options)](offset);
      offset += tmp.buftype.maxlength.length;
      stringObject.length = buffer[getReadFunction(tmp.buftype.length, options)](offset);
      offset += tmp.buftype.length.length;
      stringObject.value = buffer[getReadFunction(tmp.buftype.value, options)]('ascii', offset, offset + stringObject.length);
      return stringObject;

    case "BOOL":
      return Boolean(buffer[getReadFunction(tmp, options)](tmp.offset) & getBitNumber(tmp.bitnumber));

    default:
      return buffer[getReadFunction(tmp, options)](tmp.offset);
  }
}

const createBDFForArrayOf = (field) => {
  const arrayType = getTypeField(field);
  let tmp = [];
  let offset = field.offset;
  for (let i = 0; i < field.length; i++) {
    tmp.push({
      ...field,
      ...{
        type: arrayType.plctype,
        offset: offset,
        length: arrayType.length
      }
    });
    offset += arrayType.length;
  }
  return tmp;
}

const readArrayOfFieldFromBuffer = (buffer, field, options) => {
  const arraybdf = createBDFForArrayOf(field);
  return arraybdf.map(arraybdfitem => readFromBuffer(buffer, arraybdfitem, options));
}

const readFromBuffer = (buffer, field, options) => {
  const isArrayOf = field.type.indexOf("ARRAY") > -1;
  return (isArrayOf) ?
    readArrayOfFieldFromBuffer(buffer, field, options) :
    readFieldFromBuffer(buffer, field, options);
}

const parseBuffer = (buffer, bdf, options) => {
  let tmp = {};
  bdf.forEach(field => {
    if (field.hasOwnProperty('properties')) {
      tmp = {...tmp, ...{[field.name]: (tmp.hasOwnProperty(field.name)) ? 
        {...tmp[field.name], ...parseBuffer(buffer, field.properties, options)}: 
        parseBuffer(buffer, field.properties, options)}};

    }else if (field.hasOwnProperty('array')) {
      tmp = {...tmp, ...{[field.name]: (tmp.hasOwnProperty(field.name)) ?
        tmp[field.name].concat(field.array.map(arrayField => parseBuffer(buffer, arrayField, options))) :
        field.array.map(arrayField => parseBuffer(buffer, arrayField, options))}};

    }else{
      tmp = {...tmp, ...{[field.name]: readFromBuffer(buffer, field, options)}};

    }
  });
  return tmp;
}

const mergeDataInBDF = (data, bdf) => {
  const tmp = bdf.map(bf => {
    if (bf.hasOwnProperty('properties')) {
      bf.properties = mergeDataInBDF((data && data.hasOwnProperty(bf.name)) ? data[bf.name] : {}, bf.properties);
      return bf;

    }else if (bf.hasOwnProperty('array')) {
      bf.array = bf.array.map((arrItem, index) => {
        return mergeDataInBDF((data && data.hasOwnProperty(bf.name)) ? data[bf.name] : {}, arrItem);
      });
      return bf;

    }else{
      bf.value = (data && data.hasOwnProperty(bf.name)) ? data[bf.name] :  bf.default;
      return bf;

    }
  });
  return tmp;
}

const createBuffer = (data, bdf, options) => {
  const flattened = flattenBDF(mergeDataInBDF(data, bdf)).map(bf => ({...getTypeField(bf), ...bf}));
  let buf = Buffer.alloc(getBDFByteLength(bdf));
  let byteOffset = -1;
  let byteValue = 0;
  let boolValues = [];
  let tmpType = {};
  flattened.forEach(bf => {
    switch(bf.plctype) {
      case "CHAR":
      case "STRING":
        buf.write((Array.isArray(bf.value) ? bf.value.join() : bf.value), bf.offset, bf.length, 'ascii');
        break;

      case "S7STRING":
        let offset = bf.offset;
        bf.value.length = bf.value.value.length;
        buf[getWriteFunction(bf.buftype.maxlength, options)](bf.value.maxlength, offset);
        offset += bf.buftype.maxlength.length;
        buf[getWriteFunction(bf.buftype.length, options)](bf.value.length, offset);
        offset += bf.buftype.length.length;
        buf.write(bf.value.value, offset, bf.value.length, 'ascii');
        break;

      case "BOOL":
        if (byteOffset !== -1 && byteOffset !== bf.offset) {
          const index = boolValues.findIndex(bv => bv.offset === tmpType.offset);
          if (index < 0) {
            tmpType.value += byteValue;
            boolValues.push(tmpType);
          }else{
            boolValues[index].value += byteValue;
          }
          tmpType = {};
          byteOffset = -1;
        }
        if (byteOffset === -1) {
          byteOffset = bf.offset;
          byteValue = 0
          tmpType = {
            ...bf,
            ...getTypeField({type: "WORD"}),
            ...{value: byteValue}
          };
        }
        byteValue += (bf.value) ? getBitNumber(bf.bitnumber) : 0;
        break;

      default:
        buf[getWriteFunction(bf, options)](bf.value, bf.offset);
        break;
    }
  });
  if (byteOffset > -1) {
    const index = boolValues.findIndex(bv => bv.offset === tmpType.offset);
    if (index < 0) {
      tmpType.value += byteValue;
      boolValues.push(tmpType);
    }else{
      boolValues[index].value += byteValue;
    }
  }
  boolValues.forEach(bv => {
    buf[getWriteFunction(bv, options)](bv.value, bv.offset);
  });
  return buf;
}

const BufferWorker = {
  defaultOptions: {
    endianness: "BE"
  },
  encode: (bufferDescriptionFilePath, data, options) => {
    return new Promise(async (resolve, reject) => {
      const defPath = bufferDescriptionFilePath;
      const opt = {...BufferWorker.defaultOptions, ...options};
      try{
        const bdf = await init(defPath);
        checkData(data, bdf);
        return resolve(createBuffer(data, bdf, opt));
      }catch(e){
        return reject(e);
      }
    });
  },
  decode: (bufferDescriptionFilePath, buffer, options) => {
    return new Promise(async (resolve, reject) => {
      const defPath = bufferDescriptionFilePath;
      const opt = {...BufferWorker.defaultOptions, ...options};
      try{
        const bdf = await init(defPath);
        checkBuffer(buffer, bdf);
        return resolve(parseBuffer(buffer, bdf, opt));
      }catch(e){
        return reject(e);
      }
    });
  }
}

module.exports = BufferWorker;

