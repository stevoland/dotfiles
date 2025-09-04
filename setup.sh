#!/bin/bash

# nwb admin
/Applications/Privileges.app/Contents/MacOS/PrivilegesCLI -a
open -a "Google Chrome" --args --make-default-browser

git clone --recurse-submodules -j8 https://github.com/stevoland/dotfiles ~/dotfiles

# git
rm ~/.gitconfig
ln -s ~/dotfiles/git/.gitconfig ~/.gitconfig

# root for repos (for compnav)
mkdir ~/workspace

# zsh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
rm ~/.zshrc
ln -s ~/dotfiles/zsh/.zshrc ~/.zshrc
rm ~/.zprofile
ln -s ~/dotfiles/zsh/.zprofile ~/.zprofile

# tmux
mkdir -p ~/.config/tmux
ln -s ~/dotfiles/ohmytmux/.tmux.conf ~/.config/tmux/tmux.conf

# terminal
ln -s $HOME/dotfiles/ghostty $HOME/.config
ln -s ~/dotfiles/starship.toml ~/.config/starship.toml
ln -s $HOME/dotfiles/glow $HOME/Library/Preferences
ln -s $HOME/dotfiles/opencode $HOME/.config

# npm
ln -s ~/dotfiles/.npmrc ~/.npmrc

# nwb
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install gh
echo "Choose Yes when prompted to authenticate Git with your GitHub credentials"
echo ""
gh auth login -h github.com -p https -w
brew install eeveebank/tap/nwb
nwb setup all

# install apps
brew install rcmdnk/file/brew-file
ln -s ~/dotfiles/brewfile ~/.config/brewfile
brew file install

curl -fsSL https://bun.sh/install | bash
npm install swpm --global

helm plugin install https://github.com/helm-unittest/helm-unittest.git

go install github.com/edi9999/path-extractor@latest
ln -s $HOME/go/bin/path-extractor $HOME/.local/bin/pe

git clone https://github.com/tim-janik/jj-fzf ~/workspace/tim-janik/jj-fzf
ln -s $HOME/workspace/tim-janik/jj-fzf/jj-fzf $HOME/.local/bin/jj-fzf

# https://macos-defaults.com/
defaults write -g InitialKeyRepeat -int 15
defaults write -g KeyRepeat -int 1
defaults write http://com.apple.finder AppleShowAllFiles YES
defaults write com.apple.dock "autohide" -bool "true"
defaults write com.apple.dock "autohide-time-modifier" -float "0.1"
defaults write com.apple.dock "tilesize" -int "48"
killall Dock
defaults write com.apple.screencapture "location" -string "$HOME/Downloads"
killall SystemUIServer
defaults write com.apple.iphonesimulator "ScreenShotSaveLocation" -string "$HOME/Downloads"

# lets go
open /Applications/ghostty.app
