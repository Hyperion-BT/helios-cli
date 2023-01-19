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

The cli searches in the current directory for any necessary Helios modules. Additional module search directories can be included using the `-I` flag.

Parameters can be set using the `-D<param-name> <param-value>` option:
```bash
$ helios compile my_script.hl -DMY_PARAM 100 -o my_script.json
```

### Evaluating a parameter

```shell
$ helios eval my_script.hl MY_PARAM
```

Similar to `compile`, additional module search directories can be included using the `-I` flag, and parameters can be set using the `-D<param-name> <param-value>` option.

### Calculating a script address

For testnet:
```shell
$ helios address my_script.json
```

For mainnet:
```shell
$ helios address my_script.json --mainnet
```
