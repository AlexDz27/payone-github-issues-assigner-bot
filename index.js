const fs = require('fs')

const PAYONE_ACCOUNT_NAME = 'PAYONE-GmbH'

const assignees = JSON.parse(fs.readFileSync('./assignees.json'))
const queue = JSON.parse(fs.readFileSync('./queue.json'))

/**
 * This is the main entrypoint to the Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  app.on("issues.opened", async (context) => {
    console.log('New call: ' + new Date())

    const newIssue = context.issue()
    return context.octokit.issues.addAssignees({
      owner: PAYONE_ACCOUNT_NAME,
      repo: newIssue.repo,
      issue_number: newIssue.issue_number,
      assignees: getAssigneeFromQueue(assignees, queue)
    })
  });
};


/**
 * Returns 'assignee' GitHub login from 'assignees' file. Also does side effects - updates 'assignees' file.
 *
 * This function uses notion of queue. The algorithm:
 *   1. Transform 'assignees' from JSON into 'activeAssignees' objects with property 'index' that shows their index
 *      according to their position in the JSON file
 *   2. Get the person 'toBeAssigned'.
 *   3. Get the person 'toBeAssignedNext'.
 *   4. Update 'queue.json' file with this person's data (index and name)
 *   5. Return array with single value - 'toBeAssigned' person's GitHub login.
 *
 *   Edge cases for steps 2 and 3:
 *     Step 2:
 *       - The current 'toBeAssigned' person have deactivated themselves, thus producing 'undefined'.
 *         > In this case we increment the queue index with respect to possible minimum and maximum
 *           indices' values (boundaries).
 *
 *     Step 3:
 *       - Further 'toBeAssignedNext' persons have deactivated themselves, thus producing 'undefined'.
 *         > In this case we increment the array index value, thus, producing the next person
 *
 *         > And even still after incrementing until the end when we have 'toBeAssignedNext' 'undefined' meaning
 *           that we've reached the end of 'activeAssignees' array, we set the array index to 0 - starting the search
 *           again.
 *
 * @param {Array} assignees
 * @param {Object} queue
 * @return [string] - Returns array with single string value (GitHub username of the assignee)
 */
function getAssigneeFromQueue(assignees, queue) {
  const activeAssignees = assignees.flatMap((assignee, index) => assignee.active ? {...assignee, index} : [])

  let activeAssigneesMinBoundary = activeAssignees[0].index
  let activeAssigneesMaxBoundary = activeAssignees[activeAssignees.length - 1].index
  let toBeAssigned = activeAssignees.find(assignee => assignee.index === queue._index)
  while (toBeAssigned === undefined) {
    if (queue._index > activeAssigneesMaxBoundary || queue._index < activeAssigneesMinBoundary) {
      queue._index = activeAssigneesMinBoundary
    } else {
      queue._index++
    }

    toBeAssigned = activeAssignees.find(assignee => assignee.index === queue._index)
  }

  const toBeAssignedArrIndex = activeAssignees.findIndex(assignee => assignee.index === toBeAssigned.index)
  let toBeAssignedNextArrIndex = toBeAssignedArrIndex + 1
  let toBeAssignedNext = activeAssignees[toBeAssignedNextArrIndex]
  if (toBeAssignedNext === undefined) {
    toBeAssignedNextArrIndex = 0
    while (toBeAssignedNext === undefined) {
      toBeAssignedNext = activeAssignees[toBeAssignedNextArrIndex]
      toBeAssignedNextArrIndex++
    }
  }

  queue._index = toBeAssignedNext.index
  queue.toBeAssigned = toBeAssignedNext.name
  fs.writeFileSync('./queue.json', JSON.stringify(queue, null, 2))

  return [toBeAssigned.githubLogin]
}

/**
 * Get random assignee
 *
 * @param {Array} assignees
 * @returns [string] - Returns array with single string value (GitHub username of the assignee)
 */
function getRandomAssignee(assignees) {
  const randomAssignee = getRandomArrayItem(assignees)

  return [randomAssignee.githubLogin]


  function getRandomArrayItem(array) {
    const randomArrayItem = array[getRandomArrayIndex(array)]

    return randomArrayItem


    function getRandomArrayIndex(array) {
      const randomArrayIndex = Math.floor( Math.random() * array.length )

      return randomArrayIndex
    }
  }
}