const net = require('net')
const dgram = require('dgram')
const util = require('util')
const color = require('../../util/color')

const PORT = 1982
const MCAST_ADDR = '239.255.255.250'
const discMsg = new Buffer('M-SEARCH * HTTP/1.1\r\nMAN: "ssdp:discover"\r\nST: wifi_bulb')

class YeeDevice {
  constructor(did, loc, model, power, bri, hue, sat, name, cb, mijia) {
    this.mijia = mijia
    this.did = did
    this.model = model
    this.connected = false
    this.sock = null
    this.retry_tmr = null
    this.hb_tmr = null
    this.hb_lost = 0
    this.retry_cnt = 0
    this.propChangeCb = cb
    this.update(loc, power, bri, hue, sat, name)
  }

  update(loc, power, bri, hue, sat, name) {
    const tmp = loc.split(':')
    const host = tmp[0]
    const port = tmp[1]
    this.host = host
    this.port = parseInt(port, 10)
    this.power = power == 'on' ? 1 : 0
    this.bright = bri
    this.hue = parseInt(hue, 10)
    this.sat = parseInt(sat, 10)
    this.name = name
    this.hb_lost = 0
  }

  connect(cb) {
    if (this.connected) {
      return
    }
    this.connected = true
    this.sock = new net.Socket()
    this.sock.on('data', data => {
      const msg = data.toString()
      const rsps = msg.split('\r\n')
      rsps.forEach(json => {
        if (!json || json.length == 0) {
          return
        }
        try {
          JSON.parse(json, (k, v) => {
            if (k == 'id' && v == -1) {
              this.hb_lost = 0
            }
            if (k == 'power') {
              this.power = v == 'on' ? 1 : 0
              this.propChangeCb(this, 'power', this.power)
            } else if (k == 'bright') {
              this.bright = parseInt(v, 10)
              this.propChangeCb(this, 'bright', this.bright)
            } else if (k == 'hue') {
              this.hue = parseInt(v, 10)
              this.propChangeCb(this, 'hue', this.hue)
            } else if (k == 'sat') {
              this.sat = parseInt(v, 10)
              this.propChangeCb(this, 'sat', this.sat)
            } else if (k == 'rgb') {
              const rgb = parseInt(v, 10)
              const r = ((rgb & 0xff0000) >> 16) / 255.0
              const g = ((rgb & 0xff00) >> 8) / 255.0
              const b = (rgb & 0xff) / 255.0
              ;[this.hue, this.sat] = color.rgb2hsv(r, g, b)
              this.propChangeCb(this, 'hue', this.hue)
              this.propChangeCb(this, 'sat', this.sat)
            }
          })
        } catch (e) {
          this.mijia.log.error(`ERROR ${e} - ${this.did} - ${json}`)
        }
      })
    })

    this.sock.on('end', () => {
      this.mijia.log.error(`END ${this.did}`)
      this.handleSockError(val => cb(val))
    })

    this.sock.on('error', e => {
      this.mijia.log.error(`YEELIGHT ${e} - ${this.did}`)
      this.handleSockError(val => cb(val))
    })

    var timer
    this.sock.connect(
      this.port,
      this.host,
      () => {
        this.sock.setNoDelay(true)
        this.retry_cnt = 0
        clearTimeout(timer)
        clearTimeout(this.retry_tmr)
        clearInterval(this.hb_tmr)
        this.hb_tmr = setInterval(() => {
          this.hb_lost++
          if (this.hb_lost >= 2) {
            this.mijia.log.warn(`HEARTBEAT lost for ${this.did}, close socket and reconnect`)
            this.handleSockError(val => cb(val))
            return
          }
          // this.mijia.log.debug(`Ping: ${this.did}`);
          this.sendCmd(
            {
              id: -1,
              method: 'get_prop',
              params: ['power', 'bright', 'rgb'],
            },
            () => {}
          )
        }, 5000)
        cb(0)
      }
    )
    timer = setTimeout(() => {
      if (this.sock) {
        this.sock.end()
      }
    }, 15000)
  }

  handleSockError(cb) {
    this.connected = false
    this.sock = null
    clearTimeout(this.retry_tmr)
    clearInterval(this.hb_tmr)
    this.retry_tmr = setTimeout(() => {
      this.retry_cnt = this.retry_cnt + 1
      if (this.retry_cnt > 3) {
        cb(-1)
        return
      }
      this.mijia.log.warn(`RETRY CONNECT @${this.did}: ${this.retry_cnt}`)
      this.connect(val => cb(val))
    }, 1000)
  }

  setPower(is_on, callback) {
    if (!this.connected) {
      callback(new Error(`Cannot send COMMAND to ${this.did}`))
      return
    }
    this.power = is_on
    this.sendCmd(
      {
        id: 1,
        method: 'set_power',
        params: [is_on ? 'on' : 'off', 'smooth', 500],
      },
      callback
    )
  }

  setBright(val, callback) {
    if (!this.connected) {
      callback(new Error(`Cannot send COMMAND to ${this.did}`))
      return
    }
    this.bright = val
    const runCm = () => {
      this.sendCmd(
        {
          id: 2,
          method: 'set_bright',
          params: [val, 'smooth', 500],
        },
        callback
      )
    }
    if (!this.power) {
      this.setPower(1, result => {
        if (result) {
          callback(result)
        } else {
          runCm()
        }
      })
    } else {
      runCm()
    }
  }

  setColor(hue, sat, callback) {
    if (!this.connected) {
      callback(new Error(`Cannot send COMMAND to ${this.did}`))
      return
    }
    this.hue = hue
    this.sat = sat
    const runCm = () => {
      this.sendCmd(
        {
          id: 3,
          method: 'set_hsv',
          params: [hue, sat, 'smooth', 500],
        },
        callback
      )
    }
    if (!this.power) {
      this.setPower(1, result => {
        if (result) {
          callback(result)
        } else {
          runCm()
        }
      })
    } else {
      runCm()
    }
  }

  setName(name, callback) {
    this.name = name
    this.sendCmd(
      {
        id: 5,
        method: 'set_name',
        params: [new Buffer(name).toString('base64')],
      },
      callback
    )
  }

  sendCmd(cmd, callback) {
    if (this.sock == null || this.connected == false) {
      this.mijia.log.warn(`BROKEN ${this.did} - ${this.connected} - ${this.sock}`)
      callback(new Error(`Cannot send COMMAND to ${this.did}`))
      return
    }
    const msg = JSON.stringify(cmd)
    this.sock.write(`${msg}\r\n`, result => {
      if (result) {
        this.mijia.log.error(`Yeelight send error ${result}`)
        callback(new Error('Cannot send COMMAND'))
      } else {
        callback()
      }
    })
  }
}

class YeeAgent {
  constructor(ip, mijia, handler) {
    this.ip = ip
    this.mijia = mijia
    this.devices = {}
    this.handler = handler

    this.discSock = dgram.createSocket('udp4')
    this.discSock.on('message', (msg, info) => {
      this.handleDiscoverMsg(msg, info)
    })
    this.discSock.on('listening', () => {
      this.discSock.setBroadcast(true)
      this.discSock.setMulticastTTL(128)
      this.discSock.addMembership(MCAST_ADDR)
      this.mijia.log.debug(`LISTEN on ${util.inspect(this.discSock.address())}`)
    })
    this.discSock.bind(PORT)

    this.scanSock = dgram.createSocket('udp4')
    this.scanSock.on('message', (msg, info) => {
      this.handleDiscoverMsg(msg, info)
    })
  }

  handleDiscoverMsg(message, _from) {
    let did = ''
    let loc = ''
    let power = ''
    let bright = ''
    let model = ''
    let hue = ''
    let sat = ''
    let name = ''

    const headers = message.toString().split('\r\n')
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].indexOf('id:') >= 0) did = headers[i].slice(4)
      if (headers[i].indexOf('Location:') >= 0) loc = headers[i].slice(10)
      if (headers[i].indexOf('power:') >= 0) power = headers[i].slice(7)
      if (headers[i].indexOf('bright:') >= 0) bright = headers[i].slice(8)
      if (headers[i].indexOf('model:') >= 0) model = headers[i].slice(7)
      if (headers[i].indexOf('hue:') >= 0) hue = headers[i].slice(5)
      if (headers[i].indexOf('sat:') >= 0) sat = headers[i].slice(5)
      if (headers[i].indexOf('name:') >= 0) {
        const tmp = headers[i].slice(6)
        name = new Buffer(tmp, 'base64').toString('utf8')
      }
    }
    if (did == '' || loc == '' || model == '' || power == '' || bright == '') {
      this.mijia.log.warn('NO did or loc FOUND!')
      return
    }
    loc = loc.split('//')[1]
    if (loc == '') {
      this.mijia.log.warn('LOCATION format ERROR!')
      return
    }

    let device = this.devices[did]
    if (device) {
      device.update(loc, power, bright, hue, sat, name)
    } else {
      device = new YeeDevice(
        did,
        loc,
        model,
        power,
        bright,
        hue,
        sat,
        name,
        (dev, prop, val) => {
          this.handler.onDevPropChange(dev, prop, val)
        },
        this.mijia
      )
      this.devices[did] = device
      this.mijia.log.debug(`YEELIGHT found ${name}:${did} @${loc}`)
      this.handler.onDevFound(device)
    }

    if (!device.connected && device.sock == null) {
      device.connect(ret => {
        if (ret < 0) {
          this.mijia.log.error(`FAILED to connect ${name}:${did} @${loc}`)
          this.handler.onDevDisconnected(device)
        } else {
          this.mijia.log.warn(`YEELIGHT ${device.did} connected`)
          this.handler.onDevConnected(device)
        }
      })
    }
  }

  startDisc() {
    this.scanSock.send(discMsg, 0, discMsg.length, PORT, MCAST_ADDR)
  }
}

module.exports = YeeAgent
