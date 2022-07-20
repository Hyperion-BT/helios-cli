# Hyperion

This is a CLI meant to accompany the [Helios compiler](https://github.com/Hyperion-BT/Helios).

## Installation [WIP]

The end goal is to host Helios-CLI on NPM and make it available via NPX.

## Usage

Currently to try Hyperion you have to clone the repo and use the `/target/index.js` file directly.

```shell
$ node Helios-CLI/target/index.js 
  ...
```

### To use Hyperion:

  ```shell

  $ helios-cli --help
    Usage: Helios-Cli [options] [command]

    A small helper CLI for the Helios language.

    Options:
      -V, --version                       output the version number
      -h, --help                          display help for command

    Commands:
      compile [options] <file_path>       Compiles a Helios or Helios Data file to JSON.
      pretty_print [options] <file_path>  Pretty print Helios source code.
      deserialize [options] <file_path>   Deserialze Plutus Core from bytes.
      dump [options] <file_path>          Dumps Plutus Core CBOR as bytes or a HexString.
      parse [options] <file_path>         Parses Helios code.
      tokenize [options] <file_path>      Tokenizes Helios code.
      help [command]                      display help for command

  ```
