# io-buffer-worker
A node.js buffer encoder / decoder for PLC data communication.

This project is aimed to provide basic conversion from buffer to javascript object or from javascript object to buffer based on a json description file.

The data profile must always reflect the data table defined in the PLC.

You're free to create the needed javascript object structure you need.

I've built this library because it's not easy to define string length and boolean doesn't exist in Google's protocol buffer.

# WORK IN PROGRESS

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

Because `encode` and `decode` functions return promise, it can be used with async / await.

# PLC Data types

* BOOL (1 byte + bit number parameter)
* BYTE (1 byte length)
* INT/UINT/WORD (2 bytes length)
* DINT/UDINT/DWORD (4 bytes length)
* REAL (4 bytes length)
* CHAR (1 byte length)
* CHAR[length] (`length` bytes as a parameter)
* STRING[length] (`length` bytes as a parameter)
* S7STRING[length] (`length` bytes as a parameter, Siemens typed string with maximum length et real length in the first two bytes)

# Define buffer fields 

All length numbers is a count of bytes (8 bits) to stay close to the PLC data types, 'cos we're stick to low level programming ;-)

## General representation of a field

```json
{
  "name": "(string) your custom object property name",
  "type": "(string) the PLC data type",
  "default": "defaut value if object property is not defined before encoding",
  "offset": "(unsigned integer) the first byte position number",
  "bitnumber": "(unsigned integer between 0 and 7) required for 'BOOL' only : the bit position in the byte read at offset",
  "length": (unsigned integer) required for 'STRING' and 'ARRAY OF ...' only : length of the string or char array"
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

The json description file is an array of objects.

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
  }
]
```

The example above will result in, the values are just example of what you should have in your PLC :

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

And also, you'll find some commits for backup : git is for versionning but it's also my backup tool, some commits may not be usefull but, by the way, that's how I work.

# TODO

* create a TODO list

# Contributors

* Julien Ledun <j.ledun@iosystems.fr>

Enjoy!

