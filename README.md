# Hyperion

This is a CLI meant to accompany the [Plutus Light compiler](https://github.com/OpenEngineer/plutus-light).

## Installation [WIP]

The end goal is to host Hyperion on NPM and make it available via NPX.

## Usage

Currently to try Hyperion you have to:

- Clone the repo:

  ```shell
  $ git clone https://github.com/Ch1n3du/Hyperion
    ...
  ```

- To use Hyperion:

  ```shell

  $ node Hyperion/target/index.js
    Usage: Hyperion [options] [command]

    A small CLI to help the ergonomics of Plutus-Light.
    Options:
      -V, --version                       output the version number
      -h, --help                          display help for command

    Commands:
      compile [options] <file_path>       Compiles a Plutus-Light or Plutus-Light Data file to JSON.
      pretty_print [options] <file_path>  Pretty print Plutus-Light source code.
      deserialize [options] <file_path>   Deserialze Plutus Core from bytes.
      dump [options] <file_path>          Dumps Plutus Core CBOR as bytes or a HexString.
      parse [options] <file_path>         Parses Plutus Light.
      tokenize [options] <file_path>      Tokenizes Plutus Light.
      help [command]                      display help for command
  ```