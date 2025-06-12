eval $(thefuck --alias)

source <(switcher init zsh)

# optionally use alias `s` instead of `switch`
alias s='switch'

# optionally use command completion
source <(switch completion zsh)

eval "$(fnm env --use-on-cd --shell zsh)"

alias ls='eza --icons --no-user -la'
# alias cat='bat --style=numbers --color=always'

alias gs='git status --short'

eval "$(pyenv init -)"
if which pyenv-virtualenv-init > /dev/null; then eval "$(pyenv virtualenv-init -)"; fi

# compnav

# REQUIRED:
export COMPNAV_DIR="$HOME/dotfiles/compnav"
export COMPNAV_H_REPOS_DIR="$HOME/workspace"

# OPTIONAL:
#
# Show a nice preview of the directory structure.
# Uses eval to resolve ~.
export COMPNAV_FZF_OPTS="
  --height 80%
  --preview='eval tree -C {} | head -n 50'
  --preview-window=border-none"
# Always accept the first match (just an example, personally I don't recommend it).
# export COMPNAV_FZF_Z_OPTS="--select-1 --exit-0 --sync --bind 'start:accept'"

[ -f "$COMPNAV_DIR/compnav.sh" ] && source "$COMPNAV_DIR/compnav.sh"


export PATH="$HOME/.slack/bin:$PATH"


# bun completions
[ -s "/Users/stephen.collings/.bun/_bun" ] && source "/Users/stephen.collings/.bun/_bun"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

export HOMEBREW_BREWFILE_VSCODE=1

if [ -f $(brew --prefix)/etc/brew-wrap ];then
  source $(brew --prefix)/etc/brew-wrap
fi
