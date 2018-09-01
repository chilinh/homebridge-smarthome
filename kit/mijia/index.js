const Gateway = require('./gateway')
const Humidity = require('./humidity')
const Temperature = require('./temperature')
const Magnet = require('./magnet')
const Motion = require('./motion')
const Switch = require('./switch')
const Plug = require('./plug')
const CtrlLN1 = require('./ctrlln1')
const CtrlLN2 = require('./ctrlln2')
const CtrlNeutral1 = require('./ctrlneutral1')
const CtrlNeutral2 = require('./ctrlneutral2')
const SW861 = require('./sw861')
const SW862 = require('./sw862')
const Plug86 = require('./plug86')
const Natgas = require('./natgas')
const Smoke = require('./smoke')
const Curtain = require('./curtain')
// aqara
const MotionAq2 = require('./motion.aq2')
const MagnetAq2 = require('./magnet.aq2')
const SwitchAq2 = require('./switch.aq2')
const HumidityV1 = require('./humidity.v1')
const TemperatureV1 = require('./temperature.v1')
const PressureV1 = require('./pressure.v1')
// wifi device
const AirPurifier = require('./airpurifier')
const Vacuum = require('./vacuum')
const PowerPlug = require('./powerplug')
const PowerStrip = require('./powerstrip')
const Yeelight = require('./yeelight')

module.exports = mijia => {
  const devices = {}
  devices.gateway = new Gateway(mijia)
  const humidity = new Humidity(mijia)
  const temperature = new Temperature(mijia)
  devices.sensor_ht = {
    parseMsg: (json, rinfo) => {
      humidity.parseMsg(json, rinfo)
      temperature.parseMsg(json, rinfo)
    },
  }
  devices.magnet = new Magnet(mijia)
  devices.motion = new Motion(mijia)
  devices.switch = new Switch(mijia)
  devices.plug = new Plug(mijia)
  devices.ctrl_neutral1 = new CtrlNeutral1(mijia)
  devices.ctrl_neutral2 = new CtrlNeutral2(mijia)
  devices.ctrl_ln1 = new CtrlLN1(mijia)
  devices.ctrl_ln2 = new CtrlLN2(mijia)
  devices['86sw1'] = new SW861(mijia)
  devices['86sw2'] = new SW862(mijia)
  devices['86plug'] = new Plug86(mijia)
  devices.natgas = new Natgas(mijia)
  devices.smoke = new Smoke(mijia)
  devices.curtain = new Curtain(mijia)

  devices.light = (_mijia, config) => {
    new Yeelight(_mijia, config)
  }
  // wifi device
  devices['air-purifier'] = (_mijia, config) => {
    new AirPurifier(_mijia, config)
  }
  devices.vacuum = (_mijia, config) => {
    new Vacuum(_mijia, config)
  }
  devices['power-plug'] = (_mijia, config) => {
    new PowerPlug(_mijia, config)
  }
  devices['power-strip'] = (_mijia, config) => {
    new PowerStrip(_mijia, config)
  }
  // aqara
  devices['sensor_magnet.aq2'] = new MagnetAq2(mijia)
  devices['sensor_motion.aq2'] = new MotionAq2(mijia)
  devices['sensor_switch.aq2'] = new SwitchAq2(mijia)
  const humidityV1 = new HumidityV1(mijia)
  const temperatureV1 = new TemperatureV1(mijia)
  devices['weather.v1'] = {
    parseMsg: (json, rinfo) => {
      humidityV1.parseMsg(json, rinfo)
      temperatureV1.parseMsg(json, rinfo)
      PressureV1.parseMsg(json, rinfo)
    },
  }
  return devices
}
