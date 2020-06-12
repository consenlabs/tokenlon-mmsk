# Benchmark

```shell script
vim .env # <- prepare .env config file, see app/mmConfig for config items
npm instlal -g ganache-cli # <- install ganache chain
ganache-cli -i 3000 # <- launch ganache chain
npm install # <- install dependency
ts-node benchmark/MockServer.ts # <- launch mock server
node --inspect benchmark/Start.js # <- launch mmsk server
bash benchmark/bench.sh # <- run wrk
```
