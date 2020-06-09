require('dotenv').config()

const mmConf = require('./mmConfig')
const mmsk = require('../lib')

mmsk.startMMSK(mmConf)
