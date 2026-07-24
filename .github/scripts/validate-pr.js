module.exports = async ({ github, context, core }) => {
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const pullNumber = context.payload.pull_request.number;

  const changedFiles = await github.paginate(github.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  const versionChanged = changedFiles.some((file) => file.filename === ".version");

  if (!versionChanged) {
    core.setFailed("The .version file must be updated before merging.");
  }

  const query = `
    query($owner: String!, $repo: String!, $pullNumber: Int!, $cursor: String) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pullNumber) {
          reviewThreads(first: 100, after: $cursor) {
            nodes {
              isResolved
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    }
  `;

  let cursor = null;
  let unresolvedCount = 0;

  do {
    const result = await github.graphql(query, {
      owner,
      repo,
      pullNumber,
      cursor,
    });

    const threads = result.repository.pullRequest.reviewThreads;
    unresolvedCount += threads.nodes.filter((thread) => !thread.isResolved).length;
    cursor = threads.pageInfo.hasNextPage ? threads.pageInfo.endCursor : null;
  } while (cursor);

  if (unresolvedCount > 0) {
    core.setFailed(`${unresolvedCount} unresolved review thread(s) remain.`);
  }
};
