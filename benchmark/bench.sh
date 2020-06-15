#!/usr/bin/env bash

wrk -t4 -c64 -d10s \
  "http://127.0.0.1:8080/newOrder?base=DAI&quote=ETH&side=BUY&amount=1&userAddr=0xaaaaaaaaaa222222222233333333334444444444&uniqId=tqrcftxg&feefactor=0"
