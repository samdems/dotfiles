{ScrollView} = require 'atom-space-pen-views'
JenkinsGateway = require './jenkins-gateway'
rest = require 'restler'
path = require 'path'

module.exports =
class BuildListView extends ScrollView
  atom.deserializers.add(this)

  @deserialize: ({output}) ->
    new BuildListView()

  @content: ->
    @div class: "atom-runner"

  constructor: () ->
    super

  getTitle: () ->
    "Jenkins Build List"

  serialize: ->
    deserializer: 'BuildListView'
    title: @title

  clear: ->
    @html('')

  displayBuilds: (builds) ->
    @clear()
    $title = @append("<h2>#{builds.length} failing builds</h2>")
    $title.css("color", "red")
    builds.forEach (build) =>
      jenkinsUrl = atom.config.get 'jenkins.url'
      build.webUrl = build.webUrl.replace /^.*(\/job.*)$/, jenkinsUrl + '$1'
      @appendBuild(build)


  appendBuild: (build) ->
    row = document.createElement('div')
    name = document.createTextNode("#{build.name} ")
    link = document.createElement('a')
    outputLink = document.createElement('a')

    outputLink.innerHTML = "[output]"

    link.href = build.webUrl
    link.innerHTML = "[link]"

    row.appendChild(name)
    row.appendChild(link)
    row.appendChild(outputLink)
    @append(row)

    outputUrl = "#{build.webUrl}/#{build.lastBuildLabel}/consoleText"

    @find(outputLink).click (e) =>
      e.preventDefault()
      JenkinsGateway.getBuildOutput outputUrl, (err, data) =>
        @find("pre").remove()
        @append("<pre>#{data}</pre>")
