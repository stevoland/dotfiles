# /bin/bash

# nwb admin
/Applications/Privileges.app/Contents/MacOS/PrivilegesCLI -a
open -a "Google Chrome" --args --make-default-browser

git clone https://github.com/stevoland/dotfiles ~/dotfiles

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

source ~/.zshrc

# tmux
mkdir -p ~/.config/tmux
ln -s ~/dotfiles/ohmytmux/.tmux.conf ~/.config/tmux/tmux.conf

# terminal
ln -s ~/dotfiles/ghostty ~/.config/ghostty
ln -s ~/dotfiles/starship.toml ~/.config/starship.toml

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

# https://macos-defaults.com/
defaults write -g InitialKeyRepeat -int 15
defaults write -g KeyRepeat -int 1
defaults write http://com.apple.finder AppleShowAllFiles YES
defaults write com.apple.dock "autohide" -bool "true"
defaults write com.apple.dock "autohide-time-modifier" -float "0.1"
defaults write com.apple.dock "tilesize" -int "48"
killall Dock
defaults write com.apple.screencapture "location" -string "~/Downloads"
killall SystemUIServer
defaults write com.apple.iphonesimulator "ScreenShotSaveLocation" -string "~/Downloads"

# lets go
open /Applications/ghostty.app
