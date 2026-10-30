#!/usr/bin/env bash
# Writes languages.json: how much of one GitHub user's code is in each
# language, summed over every repository they own (forks excluded), as the
# landing page's Stack section draws it.
#
#   .github/scripts/languages.sh <login> [output file]
#
# Needs `gh` (authenticated; in Actions, GH_TOKEN) and `jq`. Sizes come from
# GitHub's own language detection (Linguist): bytes of source per language,
# with vendored and generated files left out, and data formats such as YAML
# and JSON not counted at all. The token decides which repositories are
# seen: the workflow's own token sees public ones, a personal access token
# with access to all repositories sees private ones too. Only totals are
# written, never repository names.
#
# Output:
#   {
#     "login": "<login>",
#     "repos": <repositories with at least one detected language>,
#     "total": <bytes over all languages>,
#     "languages": [                                   // largest first
#       {"name": "Go", "color": "#00ADD8", "bytes": 6075048, "repos": 52},
#       ...
#     ]
#   }
set -euo pipefail

login=${1:?usage: languages.sh <login> [output file]}
out=${2:-languages.json}

query='query ($login: String!, $endCursor: String) {
  user(login: $login) {
    repositories(first: 100, after: $endCursor, ownerAffiliations: OWNER, isFork: false, orderBy: {field: NAME, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        languages(first: 50, orderBy: {field: SIZE, direction: DESC}) {
          totalSize
          edges { size node { name color } }
        }
      }
    }
  }
}'

# --paginate follows pageInfo; --slurp collects the pages into one array.
pages=$(gh api graphql --paginate --slurp -f login="$login" -f query="$query")

tmp=$(mktemp)
jq --arg login "$login" '
  [.[].data.user.repositories.nodes[]] as $repos
  | ($repos | map(.languages.edges[]) | group_by(.node.name)
     | map({name: .[0].node.name, color: .[0].node.color, bytes: (map(.size) | add), repos: length})
     | sort_by(-.bytes, .name)) as $languages
  | {
      login: $login,
      repos: ($repos | map(select(.languages.totalSize > 0)) | length),
      total: ($languages | map(.bytes) | add // 0),
      languages: $languages
    }
' <<<"$pages" > "$tmp"

jq -e '.languages | length > 0' "$tmp" > /dev/null
mv "$tmp" "$out"
echo "$out: $(jq '.languages | length' "$out") languages over $(jq '.repos' "$out") repositories, $(jq '.total' "$out") bytes"
