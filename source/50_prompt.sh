# My awesome bash prompt
#
# Copyright (c) 2012 "Cowboy" Ben Alman
# Licensed under the MIT license.
# http://benalman.com/about/license/
#
# Example:
# [master:!?][cowboy@CowBook:~/.dotfiles]
# [11:14:45] $
#
# Read more (and see a screenshot) in the "Prompt" section of
# https://github.com/cowboy/dotfiles

# ANSI CODES - SEPARATE MULTIPLE VALUES WITH ;
#
#  0  reset          4  underline
#  1  bold           7  inverse
#
# FG  BG  COLOR     FG  BG  COLOR
# 30  40  black     34  44  blue
# 31  41  red       35  45  magenta
# 32  42  green     36  46  cyan
# 33  43  yellow    37  47  white

if [[ ! "${prompt_colors[@]}" ]]; then
  prompt_colors=(
    "36" # information color
    "37" # bracket color
    "31" # error color
  )

  if [[ "$SSH_TTY" ]]; then
    # connected via ssh
    prompt_colors[0]="32"
  elif [[ "$USER" == "root" ]]; then
    # logged in as root
    prompt_colors[0]="35"
  fi
fi

# Inside a prompt function, run this alias to setup local $c0-$c9 color vars.
alias prompt_getcolors='prompt_colors[9]=; local i; for i in ${!prompt_colors[@]}; do local c$i="\[\e[0;${prompt_colors[$i]}m\]"; done'

# Exit code of previous command.
function prompt_exitcode() {
  prompt_getcolors
  [[ $1 != 0 ]] && echo " $c2$1$c9"
}


# From: https://raw.github.com/git/git/e90020cdb3273af3b0c7915c0aacf16b19bbf994/contrib/completion/git-prompt.sh
# bash/zsh git prompt support
#
# Copyright (C) 2006,2007 Shawn O. Pearce <spearce@spearce.org>
# Distributed under the GNU General Public License, version 2.0.
#
# This script allows you to see the current branch in your prompt.
#
# To enable:
#
#    1) Copy this file to somewhere (e.g. ~/.git-prompt.sh).
#    2) Add the following line to your .bashrc/.zshrc:
#        source ~/.git-prompt.sh
#    3) Change your PS1 to also show the current branch:
#         Bash: PS1='[\u@\h \W$(__git_ps1 " (%s)")]\$ '
#         ZSH:  PS1='[%n@%m %c$(__git_ps1 " (%s)")]\$ '
#
# The argument to __git_ps1 will be displayed only if you are currently
# in a git repository.  The %s token will be the name of the current
# branch.
#
# In addition, if you set GIT_PS1_SHOWDIRTYSTATE to a nonempty value,
# unstaged (*) and staged (+) changes will be shown next to the branch
# name.  You can configure this per-repository with the
# bash.showDirtyState variable, which defaults to true once
# GIT_PS1_SHOWDIRTYSTATE is enabled.
#
# You can also see if currently something is stashed, by setting
# GIT_PS1_SHOWSTASHSTATE to a nonempty value. If something is stashed,
# then a '$' will be shown next to the branch name.
#
# If you would like to see if there're untracked files, then you can set
# GIT_PS1_SHOWUNTRACKEDFILES to a nonempty value. If there're untracked
# files, then a '?' will be shown next to the branch name.
#
# If you would like to see the difference between HEAD and its upstream,
# set GIT_PS1_SHOWUPSTREAM="auto".  A "<" indicates you are behind, ">"
# indicates you are ahead, and "<>" indicates you have diverged.  You
# can further control behaviour by setting GIT_PS1_SHOWUPSTREAM to a
# space-separated list of values:
#
#     verbose       show number of commits ahead/behind (+/-) upstream
#     legacy        don't use the '--count' option available in recent
#                   versions of git-rev-list
#     git           always compare HEAD to @{upstream}
#     svn           always compare HEAD to your SVN upstream
#
# By default, __git_ps1 will compare HEAD to your SVN upstream if it can
# find one, or @{upstream} otherwise.  Once you have set
# GIT_PS1_SHOWUPSTREAM, you can override it on a per-repository basis by
# setting the bash.showUpstream config variable.

# __gitdir accepts 0 or 1 arguments (i.e., location)
# returns location of .git repo
__gitdir ()
{
  # Note: this function is duplicated in git-completion.bash
  # When updating it, make sure you update the other one to match.
  if [ -z "${1-}" ]; then
    if [ -n "${__git_dir-}" ]; then
      echo "$__git_dir"
    elif [ -n "${GIT_DIR-}" ]; then
      test -d "${GIT_DIR-}" || return 1
      echo "$GIT_DIR"
    elif [ -d .git ]; then
      echo .git
    else
      git rev-parse --git-dir 2>/dev/null
    fi
  elif [ -d "$1/.git" ]; then
    echo "$1/.git"
  else
    echo "$1"
  fi
}

# stores the divergence from upstream in $p
# used by GIT_PS1_SHOWUPSTREAM
__git_ps1_show_upstream ()
{
  local key value
  local svn_remote svn_url_pattern count n
  local upstream=git legacy="" verbose=""

  svn_remote=()
  # get some config options from git-config
  local output="$(git config -z --get-regexp '^(svn-remote\..*\.url|bash\.showupstream)$' 2>/dev/null | tr '\0\n' '\n ')"
  while read -r key value; do
    case "$key" in
    bash.showupstream)
      GIT_PS1_SHOWUPSTREAM="$value"
      if [[ -z "${GIT_PS1_SHOWUPSTREAM}" ]]; then
        p=""
        return
      fi
      ;;
    svn-remote.*.url)
      svn_remote[ $((${#svn_remote[@]} + 1)) ]="$value"
      svn_url_pattern+="\\|$value"
      upstream=svn+git # default upstream is SVN if available, else git
      ;;
    esac
  done <<< "$output"

  # parse configuration values
  for option in ${GIT_PS1_SHOWUPSTREAM}; do
    case "$option" in
    git|svn) upstream="$option" ;;
    verbose) verbose=1 ;;
    legacy)  legacy=1  ;;
    esac
  done

  # Find our upstream
  case "$upstream" in
  git)    upstream="@{upstream}" ;;
  svn*)
    # get the upstream from the "git-svn-id: ..." in a commit message
    # (git-svn uses essentially the same procedure internally)
    local svn_upstream=($(git log --first-parent -1 \
          --grep="^git-svn-id: \(${svn_url_pattern#??}\)" 2>/dev/null))
    if [[ 0 -ne ${#svn_upstream[@]} ]]; then
      svn_upstream=${svn_upstream[ ${#svn_upstream[@]} - 2 ]}
      svn_upstream=${svn_upstream%@*}
      local n_stop="${#svn_remote[@]}"
      for ((n=1; n <= n_stop; n++)); do
        svn_upstream=${svn_upstream#${svn_remote[$n]}}
      done

      if [[ -z "$svn_upstream" ]]; then
        # default branch name for checkouts with no layout:
        upstream=${GIT_SVN_ID:-git-svn}
      else
        upstream=${svn_upstream#/}
      fi
    elif [[ "svn+git" = "$upstream" ]]; then
      upstream="@{upstream}"
    fi
    ;;
  esac

  # Find how many commits we are ahead/behind our upstream
  if [[ -z "$legacy" ]]; then
    count="$(git rev-list --count --left-right \
        "$upstream"...HEAD 2>/dev/null)"
  else
    # produce equivalent output to --count for older versions of git
    local commits
    if commits="$(git rev-list --left-right "$upstream"...HEAD 2>/dev/null)"
    then
      local commit behind=0 ahead=0
      for commit in $commits
      do
        case "$commit" in
        "<"*) ((behind++)) ;;
        *)    ((ahead++))  ;;
        esac
      done
      count="$behind  $ahead"
    else
      count=""
    fi
  fi

  # calculate the result
  if [[ -z "$verbose" ]]; then
    case "$count" in
    "") # no upstream
      p="" ;;
    "0  0") # equal to upstream
      p="=" ;;
    "0  "*) # ahead of upstream
      p=">" ;;
    *"  0") # behind upstream
      p="<" ;;
    *)      # diverged from upstream
      p="<>" ;;
    esac
  else
    case "$count" in
    "") # no upstream
      p="" ;;
    "0  0") # equal to upstream
      p=" u=" ;;
    "0  "*) # ahead of upstream
      p=" u+${count#0 }" ;;
    *"  0") # behind upstream
      p=" u-${count%  0}" ;;
    *)      # diverged from upstream
      p=" u+${count#* }-${count%  *}" ;;
    esac
  fi

}


# __git_ps1 accepts 0 or 1 arguments (i.e., format string)
# returns text to add to bash PS1 prompt (includes branch name)
__git_ps1 ()
{
  local g="$(__gitdir)"
  if [ -n "$g" ]; then
    local r=""
    local b=""
    if [ -f "$g/rebase-merge/interactive" ]; then
      r="|REBASE-i"
      b="$(cat "$g/rebase-merge/head-name")"
    elif [ -d "$g/rebase-merge" ]; then
      r="|REBASE-m"
      b="$(cat "$g/rebase-merge/head-name")"
    else
      if [ -d "$g/rebase-apply" ]; then
        if [ -f "$g/rebase-apply/rebasing" ]; then
          r="|REBASE"
        elif [ -f "$g/rebase-apply/applying" ]; then
          r="|AM"
        else
          r="|AM/REBASE"
        fi
      elif [ -f "$g/MERGE_HEAD" ]; then
        r="|MERGING"
      elif [ -f "$g/CHERRY_PICK_HEAD" ]; then
        r="|CHERRY-PICKING"
      elif [ -f "$g/BISECT_LOG" ]; then
        r="|BISECTING"
      fi

      b="$(git symbolic-ref HEAD 2>/dev/null)" || {

        b="$(
        case "${GIT_PS1_DESCRIBE_STYLE-}" in
        (contains)
          git describe --contains HEAD ;;
        (branch)
          git describe --contains --all HEAD ;;
        (describe)
          git describe HEAD ;;
        (* | default)
          git describe --tags --exact-match HEAD ;;
        esac 2>/dev/null)" ||

        b="$(cut -c1-7 "$g/HEAD" 2>/dev/null)..." ||
        b="unknown"
        b="($b)"
      }
    fi

    local w=""
    local i=""
    local s=""
    local u=""
    local c=""
    local p=""

    if [ "true" = "$(git rev-parse --is-inside-git-dir 2>/dev/null)" ]; then
      if [ "true" = "$(git rev-parse --is-bare-repository 2>/dev/null)" ]; then
        c="BARE:"
      else
        b="GIT_DIR!"
      fi
    elif [ "true" = "$(git rev-parse --is-inside-work-tree 2>/dev/null)" ]; then
      if [ -n "${GIT_PS1_SHOWDIRTYSTATE-}" ]; then
        if [ "$(git config --bool bash.showDirtyState)" != "false" ]; then
          git diff --no-ext-diff --quiet --exit-code || w="!"
          if git rev-parse --quiet --verify HEAD >/dev/null; then
            git diff-index --cached --quiet HEAD -- || i="+"
          else
            i="#"
          fi
        fi
      fi
      if [ -n "${GIT_PS1_SHOWSTASHSTATE-}" ]; then
        git rev-parse --verify refs/stash >/dev/null 2>&1 && s="$"
      fi

      if [ -n "${GIT_PS1_SHOWUNTRACKEDFILES-}" ]; then
        if [ -n "$(git ls-files --others --exclude-standard)" ]; then
          u="?"
        fi
      fi

      if [ -n "${GIT_PS1_SHOWUPSTREAM-}" ]; then
        __git_ps1_show_upstream
      fi
    fi

    local f="$w$i$s$u"
    printf -- "${1:- (%s)}" "$c${b##refs/heads/}${f:+ $f}$r$p"
  fi
}

# SVN info.
function prompt_svn() {
  prompt_getcolors
  local info="$(svn info . 2> /dev/null)"
  local last current
  if [[ "$info" ]]; then
    last="$(echo "$info" | awk '/Last Changed Rev:/ {print $4}')"
    current="$(echo "$info" | awk '/Revision:/ {print $2}')"
    echo "$c1[$c0$last$c1:$c0$current$c1]$c9"
  fi
}

# Maintain a per-execution call stack.
prompt_stack=()
trap 'prompt_stack=("${prompt_stack[@]}" "$BASH_COMMAND")' DEBUG


# Check for an interactive session
# [ -z "$PS1" ] && return

# Pretty colours
export CLICOLOR=1
export LSCOLORS=GxFxCxDxBxegedabagaced

# Git complete
export GIT_PS1_SHOWDIRTYSTATE=1
export GIT_PS1_SHOWUNTRACKEDFILES=1
export GIT_PS1_SHOWUPSTREAM=1
export GIT_PS1_SHOWSTASHSTATE=1

##################################################
# Fancy PWD display function
##################################################
# The home directory (HOME) is replaced with a ~
# The last pwdmaxlen characters of the PWD are displayed
# Leading partial directory names are striped off
# /home/me/stuff          -> ~/stuff               if USER=me
# /usr/share/big_dir_name -> ../share/big_dir_name if pwdmaxlen=20
##################################################
bash_prompt_command() {
    # How many characters of the $PWD should be kept
    local pwdmaxlen=25
    # Indicate that there has been dir truncation
    local trunc_symbol=".."
    local dir=${PWD##*/}
    pwdmaxlen=$(( ( pwdmaxlen < ${#dir} ) ? ${#dir} : pwdmaxlen ))
    NEW_PWD=${PWD/#$HOME/\~}
    local pwdoffset=$(( ${#NEW_PWD} - pwdmaxlen ))
    if [ ${pwdoffset} -gt "0" ]
    then
        NEW_PWD=${NEW_PWD:$pwdoffset:$pwdmaxlen}
        NEW_PWD=${trunc_symbol}/${NEW_PWD#*/}
    fi
}


bash_prompt() {
    case $TERM in
     xterm*|rxvt*)
         local TITLEBAR='\[\033]0;\h: \W\007\]'
          ;;
     *)
         local TITLEBAR=""
          ;;
    esac
    local NONE="\[\033[0m\]"    # unsets color to term's fg color

    # regular colors
    local K="\[\033[0;30m\]"    # black
    local R="\[\033[0;31m\]"    # red
    local G="\[\033[0;32m\]"    # green
    local Y="\[\033[0;33m\]"    # yellow
    local B="\[\033[0;34m\]"    # blue
    local M="\[\033[0;35m\]"    # magenta
    local C="\[\033[0;36m\]"    # cyan
    local W="\[\033[0;37m\]"    # white

    # emphasized (bolded) colors
    local EMK="\[\033[1;30m\]"
    local EMR="\[\033[1;31m\]"
    local EMG="\[\033[1;32m\]"
    local EMY="\[\033[1;33m\]"
    local EMB="\[\033[1;34m\]"
    local EMM="\[\033[1;35m\]"
    local EMC="\[\033[1;36m\]"
    local EMW="\[\033[1;37m\]"

    # background colors
    local BGK="\[\033[40m\]"
    local BGR="\[\033[41m\]"
    local BGG="\[\033[42m\]"
    local BGY="\[\033[43m\]"
    local BGB="\[\033[44m\]"
    local BGM="\[\033[45m\]"
    local BGC="\[\033[46m\]"
    local BGW="\[\033[47m\]"


    local exit_code=$?
  # If the first command in the stack is prompt_command, no command was run.
  # Set exit_code to 0 and reset the stack.
  [[ "${prompt_stack[0]}" == "prompt_command" ]] && exit_code=0
  prompt_stack=()

  # Manually load z here, after $? is checked, to keep $? from being clobbered.
  [[ "$(type -t _z)" ]] && _z --add "$(pwd -P 2>/dev/null)" 2>/dev/null

  # While the simple_prompt environment var is set, disable the awesome prompt.
  [[ "$simple_prompt" ]] && PS1='\n$ ' && return

  prompt_getcolors
  
  PS1="\n"

    if [[ $(uname) = MINGW* ]]; then
        # The user & host stuff is lengthy and not very useful in git bash
        PS1="${EMC}\${NEW_PWD}${EMY}$(prompt_svn)\$(__git_ps1 '[%s]')${EMW}\\$ ${NONE}"
    else
        PS1="$c0$TITLEBAR\u@\h ${EMC}\${NEW_PWD}${EMY}$(prompt_svn)\$(__git_ps1 '[%s]')${EMW}\\$ ${NONE}"
    fi
    # extra backslash in front of \$ to make bash colorize the prompt

}

PROMPT_COMMAND=bash_prompt_command
bash_prompt
unset bash_prompt
