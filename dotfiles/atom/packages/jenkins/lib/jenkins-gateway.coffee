'use strict'

rest = require 'restler'
xml2js = require 'xml2js'

_checkConfig = () ->
  atom.config.get('jenkins.url')

_get = (url, cb) ->
  httpAuthOptions = {
    username: atom.config.get('jenkins.username'),
    password: atom.config.get('jenkins.password')
  }
  options = if atom.config.get('jenkins.username') then httpAuthOptions else {}

  rest.get(url, options).on 'complete', (data) =>
    cb(data)

module.exports = {
  getBuildOutput: (url, cb) ->
    if !_checkConfig()
      cb('please define jenkins.url (and optionally jenkins.username and jenkins.password) in your atom config file.', '')
    else
      _get url, (data) ->
        cb(undefined, data)

  getFailingBuilds: (cb) ->
    if !_checkConfig()
      cb('please define jenkins.url (and optionally jenkins.username and jenkins.password) in your atom config file.', [])
      return

    failedBuilds = []

    #_get 'https://ci.braintreepayments.com/view/Venmo%20Touch/cc.xml', (data) ->
    _get atom.config.get('jenkins.url') + '/cc.xml', (data) ->
      xml2js.parseString data, (err, result) =>
        if err
          console.error(err)
          console.error(data)
          cb('failed to reach jenkins.url #{atom.config.get("jenkins.url")}', [])
        else
          result.Projects.Project.forEach (project) =>
            lastBuildStatus = project.$.lastBuildStatus
            if lastBuildStatus != 'Success' and lastBuildStatus != 'Unknown'
              failedBuilds.push(project.$)
          cb(undefined, failedBuilds)
}
