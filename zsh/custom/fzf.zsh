source <(fzf --zsh)

export FZF_DEFAULT_OPTS="
  --ansi
  --color light
  --height 50% --layout=reverse --margin 1,1
  --bind 'ctrl-j:jump-accept'
  --color header:italic
  --header 'CTRL-J: quickly accept a selection'
  "
export FZF_DEFAULT_COMMAND="bfs -color -not -name '.' -exclude \\( -name .git -or -name .hg \\) -printf '%P\n' 2>/dev/null"
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND="bfs -color -not -name '.' -nohidden -type d -printf '%P\n' 2>/dev/null"

# Preview file content using bat (https://github.com/sharkdp/bat)
export FZF_CTRL_T_OPTS="
  --preview 'bat -n --color=always {}'
  --bind 'ctrl-/:change-preview-window(down|hidden|)'"
# CTRL-/ to toggle small preview window to see the full command
# CTRL-Y to copy the command into clipboard using pbcopy
export FZF_CTRL_R_OPTS="
  --preview 'echo {}' --preview-window up:3:hidden:wrap
  --bind 'ctrl-/:toggle-preview'
  --bind 'ctrl-y:execute-silent(echo -n {2..} | pbcopy)+abort'
  --color header:italic
  --header 'CTRL-Y: copy command into clipboard'"
# Print tree structure in the preview window
export FZF_ALT_C_OPTS="
  --height 80%
  --preview='tree -C {} | head -n 50'
  --preview-window=border-double,bottom"

_fzf_compgen_path() {
    bfs -H "$1" -color -exclude \( -depth +0 -hidden \) 2>/dev/null
}
_fzf_compgen_dir() {
    bfs -H "$1" -color -exclude \( -depth +0 -hidden \) -type d 2>/dev/null
}

