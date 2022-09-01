# Heph

Heph is a CLI tool for writing smart-contracts in the [Helios programming language](https://github.com/Hyperion-BT/Helios).
Heph is inspired by Rust's [Cargo](https://github.com/rust-lang/cargo) and Cairo's [Nile](https://github.com/OpenZeppelin/nile).

## Installation

To install Heph:

```shell
$ sudo npm i -g @hyperionbt/heph
  ...
```

## Usage

### Creating a Project

To create a new project, type `heph init <project-name>`, for example:

```shell
$ heph init atomic
  ✨ Created project 'atomic'
     Type 'cd atomic'
     Then type 'heph compile' to compile the project.
```

### Compiling Code

#### Compiling a Project

To compile a Heph project run compile from inside the project directory, like so:

```shell
$ heph compile
  Creating 'build/' to store builds.
  🤖 Compiling all files in './'.
  🔨 Compiling 'atomic.hl'
  ✅ Done
```

Heph looks for a `heph.config.json` whenever `heph compile` is used to know where to find the contracts.

#### Compiling a Single File

To compile a single file Heph can be used like:

```shell
$ heph compile -i always.hl
  🔨 Compiling 'always.hl'
  ✅ Done
```

The name of the output file can be specified using the `-o <out_file-path>` option and contract parameters can be specified using the `-p <params-path>`.

```shell
$ heph compile -i always.hl \ 
    -o cool_output.json \
    -p secrets.json
  ...
```

>**Note:** The file extensions for the output file and the params file are not necessary,

#### Compiling a directory

If for whatever reason you want to compile a whole directory that can be done by typing:

```shell
$ heph compile -d <directory-path>
  ...
```
### Adding a Smart Contract to your project

To add a new contract to your project, you can use `heph add <script-purpose> <contract-name>`.

```shell
$ heph add spending atomic_nft
  Created './atomic_nft.hl' to store the contract
  Created 'tests/atomic_nft.test.hl' to store the tests.
  Created 'params/atomic_nft.params.json' to store the contract params.

```

### TODO

- [ ] Add testing with `heph test`.
- [ ] Add contracts to project using `heph add <script-purpose> <contract-name>`.
