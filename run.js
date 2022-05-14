const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, '.env') })

const userName = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const db = process.env.MONGO_DB_NAME;
const collection = process.env.MONGO_COLLECTION

// Establish MongoDB connection 
/* Our database and collection */
const databaseAndCollection = { db: db, collection: collection };

const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = `mongodb+srv://${userName}:${password}@cluster0.zoqi0.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

let http = require("http");
let express = require("express");

let bodyParser = require("body-parser"); /* To handle post parameters */
let app = express();

// process command line
const args = process.argv.slice(2);
if (args.length != 0) {
  console.log("Usage: node run.js");
  process.exit(1);
}
const port = 5000;

async function main() {


  try {
    // start server
    console.log(`Server started on port ${port} and runing at http://localhost:${port}`);
    http.createServer(app).listen(port);

    // start input loop
    function prompt() {
      process.stdout.write("Stop to shutdown the server: ");
    }

    process.stdin.setEncoding("utf8");
    prompt();

    process.stdin.on('readable', function() {
      while ((dataInput = process.stdin.read()) !== null) {
        let command = dataInput.trim();
        if (command === "stop") {
          console.log("Shuting down the server");
          process.exit(0);
        } else {
          console.log(`Invalid command: ${command}`);
          prompt()
        }
      }
    });


    /* 
    * set up dynamic html generation
    */
    app.set("views", path.resolve(__dirname, "templates"));
    app.set("view engine", "ejs");

    app.use(express.static(path.resolve(__dirname, 'styles')));

    // GET
    app.get("/", async function(request, response) {

      try {
        await client.connect();
        let tweetList = new TweetList();
        let tweets = await getTweets(client, databaseAndCollection);
        tweets = tweets.reverse();
        tweets.forEach((tweet) => {
          tweet = new Tweet(tweet.name, tweet.tweet, tweet.latitude, tweet.longitude, tweet.date);
          tweetList.addTweet(tweet);
        });

        let inn = {
          tweetList: tweetList.getHtml(),
        }
        response.render("index", inn);
      } catch (e) {
        console.error(e);
      } finally {
        await client.close();
      }
    });

    app.get("/addTweet", function(request, response) {
      response.render("addTweet");
    });

    async function getTweets(client, databaseAndCollection) {

      const cursor = await client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .find();

      const result = await cursor.toArray();
      if (result) {
        return result
      }
    }

    // POST

    /* Initializes request.body with post information */
    app.use(bodyParser.urlencoded({ extended: false }));

    app.post("/addTweet", async function(request, response) {
      let { name, tweet } = request.body;
      let { latitude, longitude } = request.body;

      try {
        await client.connect();

        /* Inserting tweet */
        let date = new Date()
        let tweetJson = { name: name, tweet: tweet, latitude: latitude, longitude: longitude, date: date };

        await insertTweet(client, databaseAndCollection, tweetJson);
        // let inn = {
        //   name: tweetJson.name,
        //   tweet: tweetJson.tweet,
        //   latitude: tweetJson.latitude,
        //   longitude: tweetJson.longitude,
        //   date: date,
        // }

        response.render("processAddTweet", tweetJson);
      } catch (e) {
        console.error(e);
      } finally {
        await client.close();
      }
    });

    async function insertTweet(client, databaseAndCollection, tweet) {
      await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(tweet);
    }

    app.post("/adminRemove", async function(request, response) {

      try {
        await client.connect();

        let result = await deleteAll(client, databaseAndCollection);
        let inn = {
          numRemoved: result.deletedCount,
        }
        response.render("processAdminRemove", inn);

      } catch (e) {
        console.error(e);
      } finally {
        await client.close();
      }

    });
    async function deleteAll(client, databaseAndCollection) {
      const result = await client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .deleteMany()

      return result
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

main().catch(console.error);



class Tweet {
  #divStyle = `style="border:1px grey; border-style: none none solid none; none none none none; padding: 100px"`
  #tweetStyle = `style="font-size:30px; margin: 10px; color: white;"`
  #nameStyle = `style="font-size:15px; margin: 10px; color: white;"`
  #name
  #tweet
  #latitude
  #longitude
  #date

  constructor(name, tweet, latitude, longitude, date) {
    this.#name = name;
    this.#tweet = tweet;
    this.#latitude = latitude;
    this.#longitude = longitude;
    this.#date = date;
  }

  getHtml() {
    let html = "";
    html += `<div ${this.#divStyle}>`
    html += `<div ${this.#tweetStyle}>${this.#tweet}</div>`
    html += `<div ${this.#nameStyle}>${this.#name} | ${this.#date.toLocaleTimeString()} | ${this.#latitude},${this.#longitude}</div>`
    html += `</div>`
    return html
  }
}

class TweetList {
  #tweets = ""
  #listStyle = `style="border:1px grey; border-style: none solid none solid; width:600px; display: inline-block; margin: 0 auto;"`
  #elemStyle = `style=""`
  #numTweets = 0

  constructor() {
    this.#initHtml();
  }

  #initHtml() {
    this.#tweets += `<div ${this.#listStyle}>\n`
  }

  addTweet(tweet) {
    this.#tweets += `<div ${this.#elemStyle}>\n`;
    this.#tweets += tweet.getHtml();
    this.#tweets += `</div>\n`;
    this.#numTweets += 1;
  }
  getHtml() {
    if (this.#numTweets == 0) return "";
    return this.#tweets + `</div>\n`
  }
}


