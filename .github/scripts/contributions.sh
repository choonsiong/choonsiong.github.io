#!/usr/bin/env bash
# Writes contributions.json: one GitHub user's contribution calendar for
# the last year, as the landing page's Activity section draws it.
#
#   .github/scripts/contributions.sh <login> [output file]
#
# Needs `gh` (authenticated; in Actions, GH_TOKEN) and `jq`. The calendar
# is only available through GitHub's GraphQL API, which is why it is
# fetched here and committed rather than requested from the browser.
#
# Output:
#   {
#     "login": "<login>",
#     "total": <contributions in the window>,
#     "days": [["YYYY-MM-DD", <count>, <level 0-4>], ...]   // oldest first
#   }
set -euo pipefail

login=${1:?usage: contributions.sh <login> [output file]}
out=${2:-contributions.json}

query='query ($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}'

calendar=$(gh api graphql -f login="$login" -f query="$query" \
  --jq '.data.user.contributionsCollection.contributionCalendar')

total=$(jq '.totalContributions' <<<"$calendar")
days=$(jq -r '
  {NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4} as $level
  | [.weeks[].contributionDays[] | [.date, .contributionCount, $level[.contributionLevel]] | tojson]
  | map("    " + .) | join(",\n")
' <<<"$calendar")

tmp=$(mktemp)
{
  printf '{\n  "login": %s,\n  "total": %s,\n  "days": [\n' "$(jq -n --arg l "$login" '$l')" "$total"
  printf '%s\n' "$days"
  printf '  ]\n}\n'
} > "$tmp"

jq -e '.days | length > 0' "$tmp" > /dev/null
mv "$tmp" "$out"
echo "$out: $total contributions over $(jq '.days | length' "$out") days"
