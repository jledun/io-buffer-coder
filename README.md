# io-buffer-worker
A node.js buffer encoder / decoder for PLC data communication.

This project is aimed to provide basic conversion from buffer to javascript object or from javascript object to buffer based on a json description file.

The data profile must always reflect the data table defined in the PLC.

You're free to create the needed javascript object structure you need.

I've built this library because it's not easy to define string length and boolean doesn't exist in Google's protocol buffer.

# Install

```bash
$ npm install io-buffer-worker
```

# Use

```javascript
const BufferWorker = require('io-buffer-worker');

const options = {
  endianess: 'LE' // default value: BE
}

// encode
BufferWorker.encode('path/to/json/description/file.json', dataToEncode, options).then(
  data => console.log(data)
).catch(
  err => console.log(err)
);

// decode
BufferWorker.decode('path/to/json/description/file.json', bufferToDecode, options).then(
  data => console.log(data)
).catch(
  err => console.log(err)
);
```

# API

## BufferWorker.encode

**Params :**

* buffer and object description file : (string|array) **required**

path to file or object description array

* dataToEncode : (object) **required**

The content you want to encode.

* options : (object) not mandatory

See Options

**Returns :**

a promise with a Node.js Buffer as parameter.

## BufferWorker.decode

**Params :**

* buffer and object description file : (string|array) **required**

path to file or object description array

* bufferToDecode : (Buffer) **required**

The buffer you want to decode into a formatted object.

* options : (object) not mandatory

See Options

**Returns :**

a promise with a result object as parameter.

## Promises

Because `encode` and `decode` functions return promise, it can be used with async / await.

## Buffer and Object description file param

The `path/to/json/description/file.json` can be absolue or relative.

Both `encode` and `decode` accept the content of the file as parameter instead of a path, for example :

```javascript
BufferWorker.decode(require('path/to/json/description/file.json'), bufferToDecode, options)
```

The description file can then be generated by program at runtime.

## Options

* endianness : "BE" for Big Endian, "LE" for Little Endian

# Define buffer fields 

All length numbers is a count of bytes (8 bits) to stay close to the PLC data types, 'cos we're stick to low level programming ;-)

## General representation of a field

```json
{
  "name": "(string) your custom object property name",
  "type": "(string) the PLC data type",
  "default": "defaut value if object property is not defined before encoding",
  "offset": "(unsigned integer) the first byte position number",
  "bitnumber": "(unsigned integer between 0 and 15) required for 'BOOL' only : the bit position in the byte read at offset",
  "length": "(unsigned integer) required for 'STRING' and 'ARRAY OF ...' only : length of the string or char array",
  "properties": "(array of properties) required to define an object",
  "array": "(array of array of properties) required to define an array of objects"
}
```

## PLC Data types

* BOOL (2 bytes + bit number parameter, from 0 to 15)
* BYTE (1 byte length)
* INT/UINT/WORD (2 bytes length)
* DINT/UDINT/DWORD (4 bytes length)
* REAL (4 bytes length)
* CHAR (1 byte length)
* ARRAY OF [BOOL | INT | UINT | DINT | UDINT | WORD | DWORD | REAL | CHAR] (`length` bytes as a parameter)
* STRING (`length` bytes as a parameter, an alias for ARRAY OF CHAR)
* S7STRING (`maxlength` and `length` are set by PLC, Siemens typed string with maximum length et real length in the first two bytes)

**S7STRING format :**

```javascript
{
  maxlength: 16, // Integer
  length: 8,     // Integer
  value: "value" // String
}
```


## BOOL

```json
{
  "name": "fieldName",
  "type": "BOOL",
  "default": false,
  "offset": 32,
  "bitnumber": 4
}
```

## INT

```json
{
  "name": "fieldName",
  "type": "INT",
  "default": 0,
  "offset": 6
}
```

## UINT

```json
{
  "name": "fieldName",
  "type": "UINT",
  "default": 0,
  "offset": 2
}
```

## WORD

```json
{
  "name": "fieldName",
  "type": "WORD",
  "default": 0,
  "offset": 8
}
```

## DINT

```json
{
  "name": "fieldName",
  "type": "DINT",
  "default": 0,
  "offset": 10
}
```

## UDINT

```json
{
  "name": "fieldName",
  "type": "UDINT",
  "default": 0,
  "offset": 56
}
```

## DWORD

```json
{
  "name": "fieldName",
  "type": "DWORD",
  "default": 0,
  "offset": 32
}
```

## REAL

```json
{
  "name": "fieldName",
  "type": "REAL",
  "default": 0,
  "offset": 26
}
```

## CHAR

```json
{
  "name": "fieldName",
  "type": "CHAR",
  "default": "",
  "offset": 4
}
```

## ARRAY OF [BOOL|INT|UINT|WORD|DINT|UDINT|DWORD|REAL|BYTE|CHAR]

```json
{
  "name": "fieldName",
  "type": "ARRAY OF [BOOL|INT|UINT|WORD|DINT|UDINT|DWORD|REAL|BYTE|CHAR]",
  "default": false,
  "offset": 32,
  "length": 64
}
```

## STRING[32]

```json
{
  "name": "fieldName",
  "type": "STRING",
  "default": "",
  "offset": 4,
  "length": 32
}
```

## S7STRING

```json
{
  "name": "fieldName",
  "type": "S7STRING",
  "default": "",
  "offset": 4,
}
```

# Object structure

The json description file has to reflect the source / result javascript object structure from buffer byte #0 to buffer max length.

**The json description file is an array of objects.**

An object can have `properties` to generate sub-object.

An object can have `array` property to generate array of objects.

## Basic example

```json
[
  {
    "name": "fieldName1",
    "type": "INT",
    "default": 0,
    "offset": 0
  }, {
    "name": "fieldName2",
    "properties": [
      {
        "name": "objectPropertyName1",
        "type": "BOOL",
        "default": false,
        "offset": 2,
        "bitnumber": 0
      }, {
        "name": "objectPropertyName2",
        "type": "BOOL",
        "default": false,
        "offset": 2,
        "bitnumber": 3
      }
    ]
  }, {
    "name": "fieldName3",
    "array": [
      [
        {
          "name": "objectPropertyName3",
          "type": "BOOL",
          "default": false,
          "offset": 4,
          "bitnumber": 0
        }, {
          "name": "objectPropertyName4",
          "type": "BOOL",
          "default": false,
          "offset": 4,
          "bitnumber": 1
        }
      ], [
        {
          "name": "objectPropertyName3",
          "type": "BOOL",
          "default": false,
          "offset": 4,
          "bitnumber": 2
        }, {
          "name": "objectPropertyName4",
          "type": "BOOL",
          "default": false,
          "offset": 4,
          "bitnumber": 3
        }
      ]
    ]
  }, {
    "name": "fieldName2",
    "properties": [
      {
        "name": "objectPropertyName5",
        "type": "STRING",
        "default": false,
        "offset": 6,
        "length": 16
      }, {
        "name": "objectPropertyName6",
        "type": "REAL",
        "default": false,
        "offset": 22
      }
    ]
  }, {
    "name": "fieldName3",
    "type": "ARRAY OF UINT",
    "default": 0,
    "offset": 26,
    "length": 12
  }
]
```

The example above will result in, the values are just example of what you could have in your PLC :

```json
{
  fieldName1: 32,
  fieldName2: {
    objectPropertyName1: false,
    objectPropertyName2: true,
    objectPropertyName5: "00001254",
    objectPropertyName6: 56.37
  },
  fieldName3: [
    {
      objectPropertyName3: false,
      objectPropertyName4: true
    }, {
      objectPropertyName3: true,
      objectPropertyName4: false
    }
  ],
  fieldName4: [
    32,
    3424,
    7654,
    0,
    0,
    0,
    0,
    0,
    0,
    7,
    0,
    0
  ]
}
```

# Contributing

Please, open an issue or a pull request.

For your code contributions, please, keep in mind to stay as simple as possible and use functional programming as much as possible.

All async function must return a promise, callbacks are not allowed.

All errors must throw an error exception with locatable and unique message.

Feel free to format your code or mine with documentation in english language.

Because I learn javascript by myself and english is not my native language, there's surely a lack in documentation or spelling / grammar errors. Please, don't blame me and feel free to fix ;-)

You'll find some commits for backup in the history : git is for versionning but it's also my backup tool, some commits may not be usefull but, by the way, that's how I work.

# TODO

* create a TODO list

# Contributors

* Julien Ledun <j.ledun@iosystems.fr>

Enjoy!

