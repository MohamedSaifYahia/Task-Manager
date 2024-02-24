// app.mjs
import express from 'express';
import {dirname} from 'path';
import {readFile, readdir} from 'fs';
import {fileURLToPath} from 'url';
import * as path from 'path';
import {Task} from './task.mjs';
import hbs from 'hbs';

// Register a helper to join the tags
hbs.registerHelper('joinTags', function(tags) {
    return tags.join(', ');
});

const app = express();
// set hbs engine
app.set('view engine', 'hbs');

// Define __dirname to represent the directory this file is in
const __dirname = dirname(fileURLToPath(import.meta.url));

// Middleware to serve static files from public
app.use(express.static(path.join(__dirname, 'public')));

function requestLogger(req, res, next) {
  console.log("Method:", req.method);
  console.log("Path:", req.path);
  console.log("Query:", JSON.stringify(req.query));
  console.log("Body:", JSON.stringify(req.body));
  next(); // Important: move to the next middleware or route handler
}
// Middleware to parse the request body
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(requestLogger);

// TODO: use middleware to serve static files from public
// make sure to calculate the absolute path to the directory
// with import.meta.url

// TODO: use middleware required for reading body

// The global list to store all tasks to be rendered
const taskList = [];

// The reading path
const readingPath = path.resolve(__dirname, './saved-tasks');

readdir(readingPath, (err, files) => {
    if (err) {throw err;}

    files.forEach(file => {
        readFile(path.join(readingPath, file), 'utf8', (err, data) => {
            if (err) {throw err;}

            const taskData = JSON.parse(data);
            const task = new Task(taskData);
            taskList.push(task);
        });
    });
});


/**
 * This function sort tasks by the give criteria "sort-by" and "sort-order"
 * @param {Request} req query should contain "sort-by" and "sort-order"
 * @param {[Task]} l the array of tasks to be sorted
 * @return {[Task]} sorted array of tasks by the given criteria
 */
// function sortTasks(req, l) {
//   if (req.query['sort-by'] && req.query['sort-order']) {
//     const newL = [...l];
//     const crit = req.query['sort-by'];
//     const ord = req.query['sort-order'];
//     newL.sort((a, b)=>{
//       if (ord === 'asc') {
//         switch (crit) {
//           case 'due-date': {
//             const a1 = new Date(a[crit]);
//             const b1 = new Date(b[crit]);
//             if (a1 === b1) { return 0; }
//             return a1 > b1 ? 1 : -1;
//           }
//           case 'priority': {
//             return a[crit] - b[crit];
//           }
//           default: {
//             return 0;
//           }
//         }
//       } else if (ord === 'desc') {
//         switch (crit) {
//           case 'due-date': {
//             const a1 = new Date(a[crit]);
//             const b1 = new Date(b[crit]);
//             if (a1 === b1) { return 0; }
//             return a1 < b1 ? 1 : -1;
//           }
//           case 'priority': {
//             return b[crit] - a[crit];
//           }
//           default: {
//             return 0;
//           }
//         }
//       } else {
//         return [];
//       }
//     });
//     return newL;
//   } else {
//     return l;
//   }
// }
function sortTasks(req, l) {
  const pinned = l.filter(task => task.pinned);
  const notPinned = l.filter(task => !task.pinned);

  const sortFunction = (a, b) => {
      const crit = req.query['sort-by'];
      const ord = req.query['sort-order'];

      if (ord === 'asc') {
          switch (crit) {
              case 'due-date': {
                  const a1 = new Date(a[crit]);
                  const b1 = new Date(b[crit]);
                  if (a1 === b1) { return 0; }
                  return a1 > b1 ? 1 : -1;
              }
              case 'priority': {
                  return a[crit] - b[crit];
              }
              default: {
                  return 0;
              }
          }
      } else if (ord === 'desc') {
          switch (crit) {
              case 'due-date': {
                  const a1 = new Date(a[crit]);
                  const b1 = new Date(b[crit]);
                  if (a1 === b1) { return 0; }
                  return a1 < b1 ? 1 : -1;
              }
              case 'priority': {
                  return b[crit] - a[crit];
              }
              default: {
                  return 0;
              }
          }
      } else {
          return 0;
      }
  };

  const sortedPinned = [...pinned].sort(sortFunction);
  const sortedNotPinned = [...notPinned].sort(sortFunction);

  return sortedPinned.concat(sortedNotPinned);
}

/**
 * This function sort tasks by whether they are pinned or not
 * @param {[Task]} l the array of tasks to be sorted
 * @return {[Task]} sorted array of tasks, with pinned tasks first
 */
// function pinnedTasks(l) {
//   return [...l].sort((a, b)=>b.pinned-a.pinned);
// }
function pinnedTasks(l) {
  return [...l].sort((a, b) => {
      if (a.pinned && !b.pinned) {return -1;} // If task 'a' is pinned and 'b' is not, 'a' should be above
      if (!a.pinned && b.pinned) {return 1;} // If task 'b' is pinned and 'a' is not, 'b' should be above
      return 0; // If both tasks are either pinned or not pinned, they remain in their order
  });
}



function filterTasks(req, tasks) {
  let filteredTasks = [...tasks];

  if (req.query.titleQ) {
      filteredTasks = filteredTasks.filter(task => task.title.includes(req.query.titleQ));
  }

  if (req.query.tagQ) {
      filteredTasks = filteredTasks.filter(task => task.hasTag(req.query.tagQ));
  }

  return filteredTasks;
}

app.get('/', (req, res) => {
  const sortedTasks = sortTasks(req, pinnedTasks(taskList));
  const finalTasks = filterTasks(req, sortedTasks);
  res.render('home', { tasks: finalTasks });
});

app.get('/add', (req, res) => {
  res.render('add');
});

app.post('/add', (req, res) => {
  // Create a new task object from the form data
  const newTask = {
      title: req.body.title,
      description: req.body.description || '',
      priority: Number(req.body.priority),
      'due-date': req.body['due-date'],
      pinned: req.body.pinned === 'true',
      tags: req.body.tags ? req.body.tags.split(', ') : [],
      progress: req.body.progress
  };

  // Add the new task to the taskList
  taskList.unshift(new Task(newTask));

  // Redirect to the main/homepage to display the updated list
  res.redirect('/');
});





app.listen(3000);
