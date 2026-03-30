source <(fzf --zsh)

export FZF_FILE_COLORS='di=38;2;0;138;150:ln=35:so=32:pi=33:ex=31:bd=34;46:cd=34;43:su=30;41:sg=30;46:tw=30;42:ow=30;43'

export FZF_DEFAULT_OPTS="
--color=bg+:#1c1c1c,bg:#101010,spinner:#008a96,hl:#008a96
--color=fg:#8f8f8f,header:#008a96,info:#e6b99d,pointer:#008a96
--color=marker:#d9925b,fg+:#d4d4d4,prompt:#d9925b,hl+:#d9925b
--ansi
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

function rgf() {
  RELOAD='reload:rg --column --color=always --smart-case {q} || :'
  OPENER='if [[ $FZF_SELECT_COUNT -eq 0 ]]; then
            "$EDITOR" {1} +{2}     # No selection. Open the current line in $EDITOR.
          elif [[ $EDITOR == vim ]] || [[ $EDITOR == nvim ]]; then
            "$EDITOR" +cw -q {+f}  # Build quickfix list for the selected items.
          else
            "$EDITOR" {+1}
          fi'

  fzf --no-height --tmux 100% --disabled --ansi --multi --query "${*:-}" \
      --bind "start,change:$RELOAD" \
      --bind "enter:become:$OPENER" \
      --bind "ctrl-o:execute:$OPENER" \
      --bind 'alt-a:select-all,alt-d:deselect-all,ctrl-/:toggle-preview' \
      --delimiter : \
      --preview 'bat --color=always --highlight-line {2} {1}' \
      --preview-window 'up,border-bottom,~3,+{2}+3/3'
}
