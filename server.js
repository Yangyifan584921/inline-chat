/*
服务器
* http：相应页面和样式
* websocket：收发消息
* */
let express=require('express');
let path=require('path');
let Message=require('./model').Message;
let app=express();
app.use(express.static(path.join(__dirname,'node_modules')));
app.get('/',function (req,res) {
    //提供静态文件目录
    res.sendFile(path.resolve('./index.html'))
});
//创建一个http服务器
var server=require('http').createServer(app);
//返回io的实例
var io=require('socket.io')(server);
//保存所有的用户名和socket对象的对应关系
var sockets={};
//监听客户端连接
//socket:是连接对象，可以实现与客户端的连接，收发消息
//当客户端连接上来后，会为每一个客户端创建一个socket对象，通过此对象保证与每个客户端保持连接，收发信息
io.on('connection',function (socket) {
    //缓存用户的用户名
    let username;
    let currentRoom;
    /*socket.send({
        username:'系统',
        content:'请输入用户名',
        createAt:new Date().toLocaleString()
    });*/
    //监听客户端消息
    socket.on('message',function (msg) {
        /*console.log(msg);
        //服务器向此客户端发送消息
        socket.send('服务器'+msg);*/

        //初始值是undefined
        if(username){
            //(.+)   私聊的内容
            var reg=/^@([^ ]+) (.+)/;
            var result=msg.match(reg);
            if(result){
                //匹配到私聊
                //私聊对象的用户名
                var toUser=result[1];
                //私聊的内容
                var content=result[2];
                //toUser是变量，要用中括号
                sockets[toUser]&&sockets[toUser].send({
                    username,
                    content:content,
                    createAt:new Date().toLocaleString()
                });
                console.log(content)
                if(!sockets[toUser]){
                    sockets[toUser].send({
                        username:'系统',
                        content:'对方已下线',
                        createAt:new Date().toLocaleString()
                    })
                }

            }else {
                //没有匹配到公聊
                let message={
                    username,
                    content:msg,
                    createAt:new Date().toLocaleString()
                };
                //把消息保存在数据库中
                Message.create(message,function (err,message) {
                    if(currentRoom){
                        //进入房间在广播
                        io.in(currentRoom).emit('message',message)
                    }else {
                        //八包含_id的保存后的消息对象广播给所有的用户
                        io.emit('message',message)
                    }

                });
                //把用户的消息广播
                /*io.emit('message',{
                 username,
                 content:msg,
                 createAt:new Date().toLocaleString()
                 })*/
            }


        }else {
            //用户的第一次输入内容，会被服务器当作他的用户名
            username=msg;
            //让用户名和socket对象建立关联
            sockets[username]=socket;
            //服务器进行广播
            io.emit('message',{username:'系统',content:`欢迎${username}加入聊天室`,createAt:new Date().toLocaleString()});
        }
       /* //向所有客户端广播消息,发送message事件，时间的内容就是用户发的消息
        io.emit('message',msg)*/
    });


    //监听客户端发发送的获取历史消息事件
    socket.on('getAllMessages',function () {
        //查询所有数据，按照创建时间倒叙排列
        Message.find().sort({createAt:-1}).limit(10).exec(function (err,messages) {
            //再对数组进行倒叙
            messages.reverse();
            //谁请求就发给谁
            socket.emit('allMessages',messages)
        })
    })


    //监听客户端想加入房间的事件
    socket.on('join',function (roomName) {
        socket.join(roomName);
        if(currentRoom){
            //有值说明已经加入房间
            //离开旧房间
            socket.leave(currentRoom)
        }
        //加入新房间
        socket.join(roomName);
        //把新房间赋值给当前房间
        currentRoom=roomName;
    })

    //监听断开事件，把对象中的用户名删掉
    socket.on('disconnect',function () {
        delete sockets[username];
    })
    socket.on('delete',function (id) {
        Message.remove({_id:id},function (err,result) {
            socket.emit('delete',id)
        })
    })
});



server.listen(8080);



/*
* 1.实现匿名聊天
*      a.绑定点击事件
*      b.点击按钮，去的输入框内容并发送给服务器
*      c.将服务器收到的客户端信息广播给所有的用户
*      d.将用户接收到的信息放到列表
* */

/*
* 2.具名聊天
*      a.当用户第一次访问的时候，提醒用户输入用户名
*      b.用户的第一次输入内容，会被服务器当作他的用户名
*      c.以后用户再次发送内容的时候，会认为是此用户发的信息
* */