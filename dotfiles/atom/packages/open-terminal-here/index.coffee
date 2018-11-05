###
 * Open Terminal Here - Atom package
 * https://github.com/blueimp/atom-open-terminal-here
 *
 * Copyright 2015, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * https://opensource.org/licenses/MIT
###

getActiveFilePath = () ->
  document.querySelector('.tree-view .selected')?.getPath?() ||
    atom.workspace.getActivePaneItem()?.buffer?.file?.path

getRootDir = () ->
  dirs = atom.project.getDirectories()
  defaultPath = dirs[0]?.path
  return defaultPath if dirs.length < 2
  activeFilePath = getActiveFilePath()
  return defaultPath if not activeFilePath
  for dir in dirs
    return dir.path if activeFilePath.indexOf(dir.path + '/') is 0
  defaultPath

filterProcessEnv = () ->
  env = {}
  for key, value of process.env
    env[key] = value if key not in [
      # Filter out environment variables leaked by the Atom process:
      'NODE_PATH', 'NODE_ENV', 'GOOGLE_API_KEY', 'ATOM_HOME'
    ]
  env

open = (filepath) ->
  if not filepath
    dirpath = getRootDir()
  else
    fs = require('fs')
    try
      isFile = fs.lstatSync(fs.realpathSync(filepath)).isFile()
    catch
      isFile = true
    if isFile
      dirpath = require('path').dirname(filepath)
    else
      dirpath = filepath
  return if not dirpath
  command = atom.config.get 'open-terminal-here.command'
  try
    require('child_process').exec command, cwd: dirpath, env: filterProcessEnv()
  catch error
    if error.code is 'EACCES'
      message = 'Permission denied to open Terminal at ' + dirpath
      atom.notifications.addError message, {dismissable: true}
    else
      throw error

switch require('os').platform()
  when 'darwin'
    defaultCommand = 'open -a Terminal.app "$PWD"'
  when 'win32'
    defaultCommand = 'start /D "%cd%" cmd'
  else
    defaultCommand = 'x-terminal-emulator'

module.exports =
  config:
    command:
      type: 'string'
      default: defaultCommand
  activate: ->
    atom.commands.add '.tree-view .selected, atom-text-editor, atom-workspace',
      'open-terminal-here:open': (event) ->
        event.stopImmediatePropagation()
        open @getPath?() || @getModel?().getPath?() || getActiveFilePath()
    atom.commands.add 'atom-workspace',
      'open-terminal-here:open-root': (event) ->
        event.stopImmediatePropagation()
        open()
