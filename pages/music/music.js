// pages/music/music.js
/*
解析音乐LRC歌词函数 parseLyric，该函数可以从如下地址进行获取
http://www.brafox.com/post/2015/HTML5/js解析lrc歌词-制作滚动歌词.html
*/
function parseLyric(lrc) {
  var lyrics = lrc.split("\n");
  var lrcObj = {};
  for (var i = 0; i < lyrics.length; i++) {
    var lyric = decodeURIComponent(lyrics[i]);
    var timeReg = /\[\d*:\d*((\.|\:)\d*)*\]/g;
    var timeRegExpArr = lyric.match(timeReg);
    if (!timeRegExpArr) continue;
    var clause = lyric.replace(timeReg, '');
    for (var k = 0, h = timeRegExpArr.length; k < h; k++) {
      var t = timeRegExpArr[k];
      var min = Number(String(t.match(/\[\d*/i)).slice(1)),
        sec = Number(String(t.match(/\:\d*/i)).slice(1));
      var time = min * 60 + sec;
      lrcObj[time] = clause;
    }
  }
  return lrcObj;
}
Page({

  /**
   * 页面的初始数据
   */
  data: {
    canLoadMore: false,
    songList: [], // 歌曲列表
    songIdList: [], // 歌曲ID列表
    scrollHeight: 0, // 滚动区域的高度
    size: 5, // 一次获取的记录数
    offset: 0, // 记录数开始位置
    type: 1, // 歌曲的类型
    page: 1, // 开始页码
    song_id: 0, // 歌曲ID
    music: {}, // 歌曲对象
    playingMusicId: 0, // 正在播放的歌曲的ID
    musicPercent: 0, // 歌曲播放进度百分比
    musicLrc: '', // 歌曲LRC歌词内容
    musicLineLrc: '' // 当前播放的LRC歌词内容
    },
  
  /**
   * 生命周期函数--监听页面加载
   */
  /*
  默认页面加载的情况主要进行：
  1.音乐播放器的初始化操作；
  2.通过系统信息的获取，确认滚动区域的高度（因为scroll-view的滚动区需要一个固定值）
  3.设置Loading加载
  4.进行API接口请求操作，主要参数包括:
    1)type:音乐类型
    2)size:每页显示数
    3)offset:数据起始位置
    数据获取成功以后通过setData设置歌曲列表以及歌曲ID的列表
  5.隐藏Loading加载
  6.页码数进行+1操作，下次数据请求从page++开始
  7.直接调用播放音乐函数playIdMusic，确认从页面打开就开始自动播放音乐
  */
  onLoad: function (options) {
    // 使用 wx.createAudioContext 获取 audio 上下文 context
    var that=this;
     // step 1
    this.audioCtx = wx.createAudioContext('myAudio');
     // step 2
    wx.getSystemInfo({
      success: function(res) {
        that.setData({
          scrollHeight: res.windowHeight - 100
        })
      },
    })
    // step 3
    wx.showLoading({
      title: '数据加载中...'
    })
    // step 4
    wx.request({
      url: 'http://tingapi.ting.baidu.com/v1/restserver/ting?method=baidu.ting.billboard.billList',
      header: {
        'content-type': 'application/json'
      },
      data: {
        type: that.data.type,
        size: that.data.size,
        offset: that.data.offset
      },
      success: function (res) {
        var idList = [];
        for (var i = 0; i < res.data.song_list.length; i++) {
          idList.push(res.data.song_list[i].song_id)
        }
        that.setData({
          songIdList: idList,
          songList: res.data.song_list
        })
        // step 5
        wx.hideLoading()
        // step 6
        that.data.page++;
        // step 7
        that.playIdMusic(that.data.songIdList[that.data.playingMusicId]);
      }
    })

  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  /*
  加载更多数据操作:
  1.设置Loading加载
  2.进行API接口请求操作，主要参数包括:
    1)offset的计算
    数据获取成功以后通过setData设置歌曲列表以及歌曲ID的列表，需要注意数组的push操作是对
    已经存在的data对象的操作
  3.隐藏Loading加载
  4.页码数进行+1操作，下次数据请求从page++开始
  */
  loadMore: function () {

    var that = this;

    if (that.data.canLoadMore === false) {
      that.setData({
        canLoadMore: true
      })

      // step 1
      wx.showLoading({
        title: '数据加载中...'
      })
      // step 2
      var newOffset = (that.data.page - 1) * that.data.size;

      console.log({
        type: that.data.type,
        size: that.data.size,
        offset: newOffset
      })
      wx.request({
        url: 'http://tingapi.ting.baidu.com/v1/restserver/ting?method=baidu.ting.billboard.billList',
        header: {
          'content-type': 'application/json'
        },
        data: {
          type: that.data.type,
          size: that.data.size,
          offset: newOffset
        },
        success: function (res) {
          if (res.data.song_list != null) {
            for (var i = 0; i < res.data.song_list.length; i++) {
              // 是对已经存在的data对象的操作，而不是对idList对象的直接操作
              that.data.songList.push(res.data.song_list[i])
              that.data.songIdList.push(res.data.song_list[i].song_id);
            }
            that.setData({
              songIdList: that.data.songIdList,
              songList: that.data.songList
            })

            // step 4
            that.data.page++;

          }
          // step 3
          wx.hideLoading();

          setTimeout(() => {
            that.setData({
              canLoadMore: false
            })
          }, 1000)

        }
      })

    }
  },
  /*
  播放下一首歌曲操作:
  1.nextMusicPos计算下一首歌曲的下标位置；
  2.通过对于歌曲数组列表中指定下标位置内容的获取，得到下一首表镜的ID值；
  3.调用playIdMusic函数
  4.设置下一首表镜播放的Id值
  */
  playNextMusic: function (event) {
    var that = this;
    // step 1
    var nextMusicPos = this.data.playingMusicId + 1;
    // step 2
    var nextMusicSongId = this.data.songIdList[nextMusicPos];
    // step 3
    this.playIdMusic(nextMusicSongId);
    // step 4
    this.setData({
      playingMusicId: nextMusicPos
    })
  },
  /*
  播放指定ID歌曲操作:
  1.通过API接口获取具体歌曲信息；
  2.成功以后设置music对象为返回来的歌曲数据
  3.通过返回来的具体歌曲中的lrclink（LRC的链接地址）进行再次请求，获取到歌曲的LRC歌词内容
  4.而获取到的歌词内容需要通过parseLyric函数进行解析
  5.进行歌曲的播放操作
  */
  playIdMusic: function (songId) {
    var that = this;
    // step 1
    var url = 'http://tingapi.ting.baidu.com/v1/restserver/ting?method=baidu.ting.song.play&songid=' + songId;
    wx.request({
      url: url,
      success: function (res) {
        // step 2
        that.setData({
          music: res.data
        })
        // step 3
        wx.request({
          url: res.data.songinfo.lrclink,
          success: function (res) {
            // step 4
            that.setData({
              musicLrc: parseLyric(res.data)
            })
            // step 5
            setTimeout(function () {
              that.audioCtx.play()
            }, 500)

          }
        })
      }
    })
  },
  /*
  播放歌曲操作（该部分操作由wxml前端按钮触发控制），整体流程和playIdMusic函数一致，拆分开来以便
  大家更容易理解:
  1.通过API接口获取具体歌曲信息；
  2.成功以后设置music对象为返回来的歌曲数据
  3.通过返回来的具体歌曲中的lrclink（LRC的链接地址）进行再次请求，获取到歌曲的LRC歌词内容
  4.而获取到的歌词内容需要通过parseLyric函数进行解析
  5.进行歌曲的播放操作
  */
  playMusic: function (event) {
    var that = this;
    var url = 'http://tingapi.ting.baidu.com/v1/restserver/ting?method=baidu.ting.song.play&songid=' + event.currentTarget.dataset.songid;
    wx.request({
      url: url,
      success: function (res) {
        that.setData({
          music: res.data
        })
        wx.request({
          url: res.data.songinfo.lrclink,
          success: function (res) {
            that.setData({
              musicLrc: parseLyric(res.data)
            })
            that.audioCtx.play();
          }
        })
      }
    })
  },
  /*
  改变歌曲的LRC歌词内容：
  1.获取歌曲播放的时间点
  2.计算音乐已经播放的百分比
  3.设置音乐播放百分比进度以及音乐歌词信息
  */
  changeMusicLrc: function (event) {
    // step 1
    var timePosition = Math.floor(event.detail.currentTime);
    // step 2
    var musicPercent = parseInt(event.detail.currentTime / event.detail.duration * 100);
    var that = this;
    // step 3
    that.setData({
      musicPercent: musicPercent,
      musicLineLrc: that.data.musicLrc[timePosition]
    })
  }

})