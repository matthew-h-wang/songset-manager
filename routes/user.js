const express = require('express');
const userApi = require('../db/user_api');
const { requiresSuperUser } = require('../middleware/user');
let userRouter = express.Router();

// View list of all users. This is restricted to admin superusers.
userRouter.get( ['/', '/list'], requiresSuperUser, async (req, res) => {
    let [rows, fields] = await userApi.getUsersSearch(req.query.search);
    res.render("user/list", {profilelist : rows, searchquery : req.query.search});
});

//Require that the user's user_id matches to access any user_id-parameterized routes
//Also allow for superusers with appropriate privilege levesl to also access to any user route
userRouter.all(`/:user_id*`, (req, res, next) => { 
    //login should match 
    if (req.user.user_id == req.params.user_id || req.user.privilege == 'Admin') {
        next();
    }
    else {
        res.status(403).send("User lacks sufficient privileges")
        // next(new Error("User lacks sufficient privileges"));
    }
})

userRouter.route('/:user_id')
    .get(async (req, res) => {
        let [privileges] = await userApi.getAllUserPrivileges();
        let [rows] = await userApi.getUser(req.params.user_id);
        if (rows.length == 1){
            res.render("user/profile", {profile : rows[0], privileges: privileges});
        }
        else {
            res.status(404).send("No such user exists. It may have been deleted or never created.");
        }
    })
    .post(async (req, res, next) => {
        if (req.body.method == "update") {
            // update username.
            if (req.body.username) {
                try {
                    let [{changedRows}] = await userApi.updateUsername(req.params.user_id, req.body.username);
                    console.log(results)
                    if (changedRows)
                        req.flash('info', `Username updated to '${req.body.username}'`)
                } catch (e) {
                    // next( new Error(`Whoops! The username "${req.body.username}" is already taken. Please go back and try a different username.`))
                    // res.status(422).send(`Whoops! The username "${req.body.username}" is already taken. Please go back and try a different username.`);
                    // return;
                    res.status(422);
                    req.flash('error', `The username "${req.body.username}" is already taken.`)                    
                }
            } 
            // update privilege. Only allowed by superusers
            if (req.body.privilege && req.user.privilege == 'Admin') {
                let [{changedRows}] = await userApi.updateUserPrivilege(req.params.user_id, req.body.privilege);
                if (changedRows)
                    req.flash('info', `Privilege updated to '${req.body.privilege}'`)
            }
            res.redirect('back');

        }
        else if (req.body.method == "delete") {
            let [results] = await userApi.deleteUser(req.params.user_id);
            if (results.affectedRows)
                req.flash('info', `Deleted '${req.params.user_id}'`)
            if (req.user.user_id == req.params.user_id)
                res.redirect('/logout');
            else 
                res.redirect(req.baseUrl);
        } else {
            res.status(422).send("POST request missing acceptable method")
        }
    })


//TODO add route to handle user privelege update
module.exports = userRouter;
