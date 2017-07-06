'use strict';

var Alexa = require('alexa-sdk');
var APP_ID = process.env.APP_ID;
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();
var moment = require('moment');

var TIMEOUT = 108000000; // 30 hours in ms

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

var handlers = {
    // Use LaunchRequest, instead of NewSession if you want to use the one-shot model
    // Alexa, ask [my-skill-invocation-name] to (do something)...
    'LaunchRequest': function () {
        this.attributes['speechOutput'] = WELCOME_MESSAGE
        // If the user either does not reply to the welcome message or says something that is not
        // understood, they will be prompted again with this text.
        this.attributes['repromptSpeech'] = WELCOME_REPROMPT;
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptSpeech']);
    },
    'CompleteDayIntent' : function () {
        console.log(process.env);
        console.log(this);
        var self = this;
        dynamodb.get({
                TableName: 'theXeffect',
                Key: {
                    userId: self.event.session.user.userId
                }
            }, function (err, data) {
                if (err) {
                    console.error(err, data);
                    return;
                }
                data.Item = data.Item || {};
                console.log('gotData for user', self.event.session.user.userId, data);
                
                var now = Date.now();
                var lostStreak = now - data.Item.lastDone > TIMEOUT;

                data.Item.streakCount = (!lostStreak && data.Item.streakCount || 0) + 1;
                data.Item.lastDone = Date.now();
                data.Item.userId = self.event.session.user.userId;
                
                dynamodb.put({
                    TableName: 'theXeffect',
                    Item: data.Item,
                    ReturnValues: 'ALL_OLD'
                }, function (err, putData) {
                    if (err) {
                        console.error(err, putData);
                        return;
                    }
                    console.log('setData', data);
                    
                    if (lostStreak) {
                        self.attributes['speechOutput'] = 'Sorry, you weren\'t in time to save your streak.';
                    } else {
                        var streak = data.Item.streakCount === 1 ? 'Congratulations, you\'ve started a streak' : 'Congratulations, you are now on a streak of '+data.Item.streakCount+' days.';
                        self.attributes['speechOutput'] = streak;
                    }
                    self.emit(':tellWithCard', self.attributes['speechOutput'], data.Item.streakCount+' days', self.attributes['speechOutput']);
                });
            });
    },
    'ProgressIntent': function () {
        var self = this;
        dynamodb.get({
            TableName: 'theXeffect',
            Key: {
                userId: self.event.session.user.userId
            }
        }, function (err, data) {
            if (err) {
                console.error(err, data);
                return;
            }
            data.Item = data.Item || {};
            console.log('gotData for user', self.event.session.user.userId, data);
            
            var now = Date.now();
            var lostStreak = now - data.Item.lastDone > TIMEOUT;
            
            if (data.Item.streakCount && lostStreak) {
                self.attributes['speechOutput'] = 'Sorry, you aren\'t in time to save your streak.\nYou were on a streak of '+data.Item.streakCount+'.';
            } else if (data.Item.streakCount) {
                var msLeft = TIMEOUT - (now - data.Item.lastDone);
                var streak = data.Item.streakCount === 1 ? 'You are currently on a streak of 1 day.' : 'You are currently on a streak of '+data.Item.streakCount+' days.'
                self.attributes['speechOutput'] = streak+'\nYou have '+moment.duration(msLeft, 'ms').humanize()+' left to maintain your streak';
            } else {
                self.attributes['speechOutput'] = 'You haven\'t started a streak yet. Let me know when you\'ve completed today';
            }
            
            self.emit(':tellWithCard', self.attributes['speechOutput'], (data.Item.streakCount || 0)+' days', self.attributes['speechOutput']); 
        });
    },
    'AMAZON.HelpIntent': function () {
        this.attributes['speechOutput'] = HELP_MESSAGE;
        this.attributes['repromptSpeech'] = HELP_REPROMPT;
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptSpeech']);
    },
    'AMAZON.RepeatIntent': function () {
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptSpeech']);
    },
    'AMAZON.StopIntent': function () {
        this.emit('SessionEndedRequest');
    },
    'AMAZON.CancelIntent': function () {
        this.emit('SessionEndedRequest');
    },
    'SessionEndedRequest':function () {
        this.emit(':tell', STOP_MESSAGE);
    },
    'Unhandled': function () {
        this.attributes['speechOutput'] = HELP_MESSAGE;
        this.attributes['repromptSpeech'] = HELP_REPROMPT;
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptSpeech']);
    }
};

var SKILL_NAME = "The X Effect";
var WELCOME_MESSAGE = "Welcome to The X Effect. You can ask a question like, what\'s my current streak? or let me know that you've completed today ... Now, what can I help you with.";
var WELCOME_REPROMPT = "For instructions on what you can say, please say help me.";
var HELP_MESSAGE = "You can ask questions such as, what\'s my current streak, or, you can say exit...Now, what can I help you with?";
var HELP_REPROMPT = "You can say things like, what\'s my current streak, or you can say exit...Now, what can I help you with?";
var STOP_MESSAGE = "Goodbye!";
var REPEAT_MESSAGE = "Try saying repeat.";