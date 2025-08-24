#!/bin/bash

iTermExec() {
  osascript <<EOF
  tell application "iTerm"
    tell current window
      create tab with default profile
      tell current session of current tab
        write text "$1"
      end tell
    end tell
  end tell
EOF
}

# Abre la primera pestaña y ejecuta los comandos
first_command="cd .. && clear"
iTermExec "$first_command"

# Abre la segunda pestaña y ejecuta los comandos
second_command="cd ../noctiluca-fe && cursor . && npm run dev"
iTermExec "$second_command"

# Abre la tercera pestaña y ejecuta los comandos
third_command="cd ../noctiluca-be/Api && dotnet run --watch"
iTermExec "$third_command"

# Inicia el contenedor de Docker en la pestaña original
docker start noctiluca-localhost

# Mueve el foco a la primera pestaña
osascript <<EOF
tell application "iTerm"
  tell current window
    select first tab
  end tell
end tell
EOF

# Cierra la pestaña original
osascript <<EOF
tell application "iTerm"
  tell current window
    tell current session
      close
    end tell
  end tell
end tell
EOF
