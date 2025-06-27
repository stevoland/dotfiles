#!/bin/bash

RUBY_VERSION=3.3.0
XCODE_VERSION=16.0.0

brew install rbenv ruby-build aria2 xcodes

rbenv init
rbenv install $RUBY_VERSION
rbenv global $RUBY_VERSION

xcodes install $XCODE_VERSION

/Applications/Privileges.app/Contents/MacOS/PrivilegesCLI -a

sudo xcode-select -s /Applications/Xcode-$XCODE_VERSION.app/Contents/Developer

xcodebuild -downloadPlatform iOS -exportPath ~/Downloads
xcodebuild -importPlatform ~/Downloads/iphonesimulator_*

