#!/bin/bash

# スクリプトのパス
SCRIPT_PATH="/Users/shoobata/IdeaProjects/imageSynthForXpress/import_layers_to_ai.jsx"

# アプリケーションIDを使用して実行
osascript <<EOF
tell application id "com.adobe.illustrator"
    activate
    do javascript file "$SCRIPT_PATH"
end tell
EOF