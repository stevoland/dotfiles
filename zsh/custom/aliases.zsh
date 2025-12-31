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

function lk {
  cd "$(walk --icons "$@")"
}
export WALK_EDITOR="less -N"
export WALK_OPEN_WITH="txt:less -N;go:code;ts:code;tsx:code;js:code;jsx:code;json:code;md:glow -p"
export WALK_STATUS_BAR='[Mode(), Owner(), Size() | PadLeft(7), ModTime() | PadLeft(12)] | join(" ")'

# # Open selected path in nvim
# alias -g P='| pe | fzf | read filename; [ ! -z $filename ] && nvim $filename'

# # Copy selected path to clipboard
# alias -g C='| pe | fzf | read filename; [ ! -z $filename ] && echo -n $filename | pbcopy'


# globalias() {
#   zle _expand_alias
#   zle expand-word
#   zle self-insert
# }
# zle -N globalias

# # space expands all aliases, including global
# bindkey -M emacs " " globalias
# bindkey -M viins " " globalias

# # control-space to make a normal space
# bindkey -M emacs "^ " magic-space
# bindkey -M viins "^ " magic-space

# # normal space during searches
# bindkey -M isearch " " magic-space

export EDITOR=nvim

export PAGER="less -X"

export UTCP_CONFIG_FILE="$HOME/.config/utcp/config.json"

npmig() {
  cd $HOME/npmbin
  npm install --save $@
  cd -
}

export PATH="$HOME/npmbin/node_modules/.bin:$PATH"

export OPENCODE_EXPERIMENTAL_LSP_TOOL=true
# export OPENCODE_EXPERIMENTAL_FILEWATCHER=true

# export PATH="$HOME/workspace/github.com/stevoland/opencode/packages/opencode/dist/opencode-darwin-arm64/bin:$PATH"
