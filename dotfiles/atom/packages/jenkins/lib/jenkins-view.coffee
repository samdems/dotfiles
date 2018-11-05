{View} = require 'atom-space-pen-views'
JenkinsGateway = require './jenkins-gateway'
rest = require 'restler'
xml2js = require 'xml2js'
BuildListView = require './build-list-view'

module.exports =
class JenkinsView extends View
  @content: ->
    @div class: 'jenkins inline-block', =>
      @div class: "status inline-block requesting", outlet: 'status'

  initialize: (serializeState) ->
    @failedBuilds = []

    atom.commands.add "atom-text-editor",
      "jenkins:list": =>
        JenkinsGateway.getFailingBuilds (err, failingBuilds) =>
          @failedBuilds = failingBuilds
          @list()

  # Returns an object that can be retrieved when package is activated
  serialize: ->
    isActive: @isActive

  # Tear down any state and detach
  destroy: ->
    @detach()

  list: ->
    if @failedBuilds.length > 0
      view = new BuildListView()
      panes = atom.workspace.getPanes()
      pane = panes[panes.length - 1].splitRight(@runnerView)
      pane.activateItem(view)
      window.test_pane = pane

      view.displayBuilds(@failedBuilds)
      view.scrollToBottom()

  updateStatusBar: ->
    JenkinsGateway.getFailingBuilds (err, failedBuilds) =>
      if err
        @status.attr('title', err.toString())
        console.error(err)
      else
        @failedBuilds = failedBuilds

        if @failedBuilds.length > 0
          @status
            .removeClass('requesting success')
            .addClass('error pointer')
            .attr('title', '#{@failedBuilds.length} failing builds.')
        else
          @status
            .removeClass('requesting error')
            .addClass('success')
            .attr('title', 'All builds passing.')

  consumeStatusBar: (statusBar) ->
    statusBar.addLeftTile(item: this)
    @status.click (e) =>
      @list()

    @ticker = setInterval((=> @updateStatusBar()), atom.config.get('jenkins.interval'))
    @updateStatusBar()
