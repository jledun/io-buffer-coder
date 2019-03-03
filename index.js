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
        flattenBDF(field.array).map(
          arrayItem => flattenBDF(arrayItem)
        ) :
      field
    );
  });
  return tmp;
}

const flattenData = (data, bdf) => {
  let tmp = [];
  data.values().forEach(key => {
    è
  });
  return tmp;
}

const getReadFunction = (plctype, options) => {
  return "".concat(
    "read",
    getTypeFunction(plctype, options)
  );
}

const getWriteFunction = (plctype, options) => {
}

const getTypeField = (plctype) => {
  return typeDefinitions.find(
    typedef => plctype.type.indexOf(typedef.plctype) > -1
  );
}

const getTypeFunction = (plctype, options) => {
  return "".concat(
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
  const lastDef = flattenBDF(bdf).pop();
  const totalLength = lastDef.offset + getFieldLength(lastDef);
  if (buffer.length !== totalLength) throw new Error(`buffer length is not what it should be.`);
}

const init = (defPath) => {
  return new Promise(async (resolve, reject) => {
    try{
      const bdf = await getFileDescription(defPath);
      checkBDFTypes(bdf);
      return resolve(bdf);
    }catch(e){
      return reject(e);
    }
  });
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
      stringObject.maxlength = buffer[getReadFunction(buftype.maxlength, options)](offset);
      offset += buftype.maxlength.length;
      stringObject.length = buffer[getReadFunction(buftype.length, options)](offset);
      offset += buftype.length.length;
      stringObject.value = buffer[getReadFunction(buftype.value, options)]('ascii', offset, offset + stringObject.length);
      return stringObject;

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
        offset: offset
      }
    });
    offset += arrayType.length;
  }
  return tmp;
}

const readArrayOfFieldFromBuffer = (buffer, field, options) => {
  const arraybdf = createBDFForArrayOf(field);
  return {[field.name]: arraybdf.map(arraybdfitem => readFromBuffer(buffer, arraybdfitem, options))};
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
      tmp = {...tmp, ...parseBuffer(buffer, field.properties, options)};

    }else if (field.hasOwnProperty('array')) {
      tmp = {...tmp, ...{[field.name]: field.array.map(arrayField => parseBuffer(buffer, arrayField, options))}};

    }else{
      tmp = {...tmp, ...{[field.name]: readFromBuffer(buffer, field, options)}};

    }
  });
  return tmp;
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
        console.log(data);
        const bdf = await init(defPath);
        checkData(data, bdf);
        return resolve(bdf);
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
        return resolve(parseBuffer(buffer, bdf, options));
      }catch(e){
        return reject(e);
      }
    });
  }
}

module.exports = BufferWorker;

