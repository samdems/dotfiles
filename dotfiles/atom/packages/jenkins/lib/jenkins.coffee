JenkinsView = require './jenkins-view'

module.exports =
  config:
    username:
      type: 'string'
      default: ''
    password:
      type: 'string'
      default: ''
    url:
      type: 'string'
      default: ''
    interval:
      type: 'integer'
      default: 60000

  jenkinsView: null

  activate: (state) ->
    @jenkinsView = new JenkinsView(state.jenkinsViewState)

  deactivate: ->
    @jenkinsView.destroy()

  serialize: ->
    jenkinsViewState: @jenkinsView.serialize()

  consumeStatusBar: (statusBar) ->
    @jenkinsView.consumeStatusBar(statusBar);
