# Helios-CLI

A CLI tool for compiling [Helios](https://github.com/Hyperion-BT/Helios) smart contracts.

## Installation

Dependencies:
  * node
  * npm

```shell
$ sudo npm i -g @hyperionbt/helios-cli
```

## Usage

### Compiling

```shell
$ helios compile my_script.hl --optimize --output my_script.json
```

The cli searches in current directory for any necessary modules. Additional module search directories can be included using the `-I` flag.

### Evaluating a parameter

```shell
$ helios eval my_script.hl MY_PARAM
```

Additional module search directories can be included using the `-I` flag.

### Calculating a script address

For testnet:
```shell
$ helios address my_script.json
```

For mainnet:
```shell
$ helios address my_script.json --mainnet
```
