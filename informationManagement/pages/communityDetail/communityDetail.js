
var app = getApp();
var util = require('../../../utils/util.js');
var WxParse = require('../../../components/wxParse/wxParse.js');
var isSubmiting = false; //防止重复点击
var likeTap = false; //防止重复点击
var kbHeight = '';

Page({
  data: {
    articleId: '',
    articleInfo: {},
    likeLogCount: '',
    likeLogItems: [],
    is_liked: '',
    phoneNumber: '',
    commentWidth: '',
    commentList: [],
    child_comment: [],
    article_style: '',
    getCommentData: {
      page: 1,
      loading: false,
      nomore: false
    },
    commentCount: '',
    imgData: {},
    showAddArticleBtn: true,
    theme_color: '#00b6f8',
    thumbUpBackgroundColor: '#3091f2',
    thumbUpColor: '#fff',
    address: '',
    showActionSheet: false,
    phoneNumCall: '',
    showReplyBox: false,
    replyBoxFocus: false,
    keyboardHeight: '50%',
    replyPlaceholder: '我来说两句',
    innerAudioContext: {
      currentTime: 0,
      duration: 0,
      canPlay: false,
      play: false
    },
    franchisee: ''
  },
  onLoad: function (options) {
    let that = this;
    app.getStorage({
      key: 'communityThemeColor-' + options.sectionid,
      success: function (res) {
        that.setData({theme_color: res.data});
      }
    })
    let articleId = options.detail,
      article_style = options.articleStyle || '',
      phoneNumber = options.phoneNumber || '',
      comment_width = options.phoneNumber ? '300rpx' : '400rpx',
      is_liked = options.dataLiked || '',
      thumbUpBackgroundColor = options.dataLiked == '1' ? '#f2f2f2' : '#3091f2',
      thumbUpColor = options.dataLiked == '1' ? '#3091f2' : '#fff',
      likeLogCount = options.dataLiked == '1' ? '' : '赞',
      onlyOwnRecord = options.onlyOwnRecord || '';
    let franchisee = options.franchisee || '';
    this.setData({
      articleId: articleId,
      article_style: article_style,
      phoneNumber: phoneNumber,
      commentWidth: comment_width,
      is_liked: is_liked,
      thumbUpBackgroundColor: thumbUpBackgroundColor,
      thumbUpColor: thumbUpColor,
      likeLogCount: likeLogCount,
      onlyOwnRecord: onlyOwnRecord,
      franchisee: franchisee
    });

    this.getArticleInfo();
    this.getLikeLog();
    this.getComment();
    this.countReadCount(articleId);

    app.globalData.communityDetailRefresh = false;
  },
  onShow: function () {
    if (app.globalData.communityDetailRefresh) {
      this.setData({
        getCommentData: {
          page: 1,
          loading: false,
          nomore: false
        },
        commentList: []
      });
      app.globalData.communityDetailRefresh = false;
      this.getComment();
    }
  },
  getArticleInfo: function (own) {
    let that = this,
      param = {
        article_id: that.data.articleId,
        page: 1,
        page_size: 100,
        sub_app_id: that.data.franchisee
      };
    if (that.data.onlyOwnRecord == 1) {
      param.only_own_record = 1;
    }
    app.sendRequest({
      hideLoading: true,
      url: '/index.php?r=AppSNS/GetArticleByPage',
      data: param,
      method: 'post',
      success: function (res) {
        if (res.status == 0) {
          let info = res.data[0];
          info.title = unescape(info.title.replace(/\\u/g, "%u"));
          if (info.content.type == 2) {
            if (info.content.url.article) {
              let artBody = info.content.url.article.body;
              if (/[>]\s+/.test(artBody)) {
                artBody = artBody.replace(/(\>)(\s+)/g, ($0, $1, $2) => {
                  return $1 + (new Array($2.length + 1).join('&nbsp;'));
                });
              }
              if (/\'/.test(artBody)) {
                artBody = artBody.replace(/\'/g, '"');
              }
              info.content_text = artBody;
              delete info.content.url.article.body;
              if (info.content.url.article.type == 3) {
                that.createAudioPlayer(info.content.url.article);
              }
            }
          }else {
            info.content_text = info.content.text.replace(/\n|\\n/g, '\n');
          }

          that.setData({
            articleInfo: info,
            is_like: info.is_liked,
            address: info.address
          });
          WxParse.wxParse('wxParseDescription', 'html', info.content_text, that, 10);
          that.getThemeColor(info.section_id);

          // if (!info.address) {
          //   that.getLocByLatAndLng(info.latitude, info.longitude, function (data) {
          //     that.setData({ address: data.address });
          //   });
          // }

          if (info.content.type == 2 && info.content.url.video) {
            that.getCurVideoUrl(info.content.url.video.url);
          }
        }
      }
    });
  },
  getLikeLog: function () {
    var that = this;
    app.sendRequest({
      hideLoading: true,
      url: '/index.php?r=AppSNS/GetLikeLogByPage',
      data: {
        page: 1,
        obj_type: 1,
        obj_id: that.data.articleId,
        page_size: 10,
        sub_app_id: that.data.franchisee
      },
      method: 'post',
      success: function (res) {
        if (res.status == 0) {
          let info = res.data;
          res.count = that.data.is_liked == '1' ? res.count : '赞'
          that.setData({
            likeLogCount: res.count,
            likeLogItems: info,
          });
        }
      }
    });
  },
  getComment: function () {
    var that = this,
      sdata = that.data.getCommentData;

    if (sdata.loading || sdata.nomore) {
      return;
    }
    sdata.loading = true;
    app.sendRequest({
      url: '/index.php?r=AppSNS/GetCommentByPage',
      data: {
        page: sdata.page,
        article_id: that.data.articleId,
        page_size: 10,
        // article_style : 0          
        article_style: that.data.article_style,
        sub_app_id: that.data.franchisee
      },
      method: 'post',
      success: function (res) {
        if (res.status == 0) {
          let info = res.data,
            oldData = that.data.commentList,
            newData = info;

          for (var i = 0; i < newData.length; i++) {
            let item = newData[i],
              likecount = item.like_count;

            item.like_count_text = likecount <= 0 ? '赞' : (likecount > 10000 ? (Math.floor(likecount / 10000) + '万') : likecount);
            item.likeAnimateShow = true;
          }

          newData = oldData.concat(newData);

          that.setData({
            commentList: newData,
            commentCount: res.count,
            'getCommentData.page': sdata.page + 1
          });
        }
        that.setData({
          'getCommentData.loading': false,
          'getCommentData.nomore': res.is_more == 0 ? true : false
        });
      },
      fail: function (res) {
        that.setData({
          'getCommentData.loading': false
        });
      }
    });
  },
  onReachBottom: function (e) {
    this.scrollTolower(e);
  },
  onPageScroll: function (e) {
    this.scrollEvent(e);
  },
  scrollTolower: function (event) {
    this.getComment();
  },
  oldscrolltop: 0,
  scrollEvent: function (event) {
    let scrolltop = event.scrollTop,
      oldscrolltop = this.oldscrolltop;

    if (scrolltop - oldscrolltop > 60) {
      this.oldscrolltop = scrolltop;
      this.setData({
        showAddArticleBtn: false
      });
    } else if (oldscrolltop - scrolltop > 60) {
      this.oldscrolltop = scrolltop;
      this.setData({
        showAddArticleBtn: true
      });
    }
  },
  imgLoad: function (event, ) {
    let owidth = event.detail.width,
      oheight = event.detail.height,
      oscale = owidth / oheight,
      cwidth = 290,
      cheight = 120,
      ewidth, eheight,
      newData = {};

    if (oscale > cwidth / cheight) {
      ewidth = cwidth;
      eheight = cwidth / oscale;
    } else {
      ewidth = cheight * oscale;
      eheight = cheight;
    }

    newData['imgData'] = {
      imgWidth: ewidth * 2.34,
      imgHeight: eheight * 2.34
    }
    this.setData(newData);
  },
  getThemeColor: function (section_id) {
    if (this.data.theme_color) {
      return;
    };
    var that = this;
    app.sendRequest({
      url: '/index.php?r=AppSNS/GetSectionByPage',
      data: {
        page: 1,
        section_id: section_id,
        sub_app_id: that.data.franchisee
      },
      method: 'post',
      success: function (res) {
        if (res.status == 0) {
          let info = res.data[0];

          that.setData({
            theme_color: info.theme_color,
          });
        }
      }
    });
  },
  turnReply: function (event) {
    event.currentTarget.dataset.parentid = event.currentTarget.dataset.id;
    this.turnComment(event);
  },
  turnComment: function (event) {
    let sectionId = event.currentTarget.dataset.sectionid,
      commentId = event.currentTarget.dataset.id,
      parentCommentId = event.currentTarget.dataset.parentid,
      articleId = this.data.articleId,
      replyto = event.currentTarget.dataset.replyto;

    this.setData({ 
      showReplyBox: true,
      replyPlaceholder: "@" + replyto,
      replyParam: {
        section_id: sectionId,
        article_id: articleId, // 话题id
        comment_id: commentId, // 评论id 如果传这个表示是在回复
        parent_comment_id: parentCommentId
      }
    });

    setTimeout(() => {
      this.setData({
        replyBoxFocus: true
      });
    }, 500);

  },
  turnToPublish: function (event) {
    app.turnToPage('/informationManagement/pages/communityPublish/communityPublish?detail=' + this.data.articleInfo.section_id + (this.data.franchisee ? ('&franchisee=' + this.data.franchisee) : ''));
  },
  articleLike: function (event) {
    var that = this,
      liked = event.currentTarget.dataset.liked,
      likeCount = +event.currentTarget.dataset.likeCount;

    if (likeTap) { return; };
    likeTap = true;

    app.sendRequest({
      hideLoading: true,
      url: '/index.php?r=AppSNS/PerformLike',
      data: {
        obj_type: 1,  // obj_type 1-话题 2-评论
        obj_id: that.data.articleId,     // obj_id 话题或评论的id
        sub_app_id: that.data.franchisee
      },
      method: 'post',
      success: function (res) {
        if (res.status == 0) {

          that.getLikeLog();

          if (liked == 1) {
            that.setData({
              'articleInfo.is_liked': 0,
              'articleInfo.like_count': likeCount - 1,
              thumbUpBackgroundColor: '#3091f2',
              thumbUpColor: '#fff',
              is_liked: '0',
            });
            app.showToast({ title: '点赞取消' });
          } else {
            that.setData({
              'articleInfo.is_liked': 1,
              'articleInfo.like_count': likeCount + 1,
              thumbUpBackgroundColor: '#f2f2f2',
              thumbUpColor: '#3091f2',
              is_liked: '1'
            });
            app.showToast({ title: '点赞成功' });
          }
          
          app.globalData.topicRefresh = true;
          app.globalData.communityPageRefresh = true;
          app.globalData.communityUsercenterRefresh = true;
          app.globalData.franchiseeCommunity = true;
        }
      },
      complete: function () {
        likeTap = false;
      }
    });
  },
  commentLike: function (event) {
    var that = this,
      liked = event.currentTarget.dataset.liked,
      id = event.currentTarget.dataset.id,
      index = +event.currentTarget.dataset.index,
      likeCount = +event.currentTarget.dataset.likeCount;
    
    if (likeTap) { return; };
    likeTap = true;

    app.sendRequest({
      hideLoading: true,
      url: '/index.php?r=AppSNS/PerformLike',
      data: {
        obj_type: 2,  // obj_type 1-话题 2-评论
        obj_id: id,     // obj_id 话题或评论的id
        sub_app_id: that.data.franchisee
      },
      method: 'post',
      success: function (res) {
        if (res.status == 0) {

          if (liked == 1) {
            var newData = {},
              likecount = likeCount - 1;
            newData['commentList[' + index + '].is_liked'] = 0;
            newData['commentList[' + index + '].like_count'] = likecount;
            newData['commentList[' + index + '].like_count_text'] = likecount <= 0 ? '赞' : (likecount > 10000 ? (Math.floor(likecount / 10000) + '万') : likecount);
            newData['commentList[' + index + '].likeAnimateShow'] = false;

            that.setData(newData);
            app.showToast({ title: '点赞取消' });
          } else {
            var newData = {},
              likecount = likeCount + 1;
            newData['commentList[' + index + '].is_liked'] = 1;
            newData['commentList[' + index + '].like_count'] = likecount;
            newData['commentList[' + index + '].like_count_text'] = likecount <= 0 ? '赞' : (likecount > 10000 ? (Math.floor(likecount / 10000) + '万') : likecount);
            newData['commentList[' + index + '].likeAnimateShow'] = false;

            that.setData(newData);
            app.showToast({ title: '点赞成功' });
          }
          app.globalData.topicRefresh = true;
          setTimeout(function () {
            let newData = {};
            newData['commentList[' + index + '].likeAnimateShow'] = true;
            that.setData(newData);
          }, 480);
        }
      },
      complete: function () {
        likeTap = false;
      }
    });
  },
  previewImage: function (event) {
    let that = this,
      curImg = event.currentTarget.dataset.src;
    app.previewImage({
      current: curImg,
      urls: that.data.articleInfo.content.imgs
    });
  },
  showActionSheet: function (event) {
    let that = this,
      telNum = that.data.phoneNumber,
      telArr = [telNum.substr(0, 3), telNum.substr(3, 4), telNum.substr(7)],
      isIphone = /ios/i.test(app.globalData.systemInfo.platform);

    if (isIphone) {

      wx.makePhoneCall({
        phoneNumber: telNum,
        success: function () { },
        fail: function () { }
      })

    } else {

      that.setData({
        phoneNumCall: telArr.join('-'),
        showActionSheet: true
      });

    }
  },
  onShareAppMessage: function (res) {
    let that = this;
    let shareTitle = this.data.articleInfo.title;
    let sharePath = util.getCurrentPageUrlWithArgs();
    return {
      title: shareTitle,
      path: sharePath,
      success: function (res) {
        app.showToast({ title: '转发成功' });
        app.CountSpreadCount(that.data.articleId);
        app.globalData.topicRefresh = true;
      },
      fail: function (res) { }
    }
  },
  turnToReport: function () {
    app.turnToPage('/informationManagement/pages/communityReport/communityReport?detail=' + this.data.articleId + '&sectionid=' + this.data.articleInfo.section_id + (this.data.franchisee ? ('&franchisee=' + this.data.franchisee) : ''));
  },
  getLocByLatAndLng: function (lat, lng, cb) {
    app.sendRequest({
      url: '/index.php?r=Map/GetAreaInfoByLatAndLng',
      data: {
        latitude: lat,
        longitude: lng
      },
      method: 'post',
      success: function (data) {
        if (data.status == 0 && typeof cb == 'function') {
          cb(data.data);
        }
      }
    })
  },
  backToPre: function () {
    wx.navigateBack();
  },
  // actionSheet
  closeActionSheet: function (event) {
    this.setData({ showActionSheet: false });
  },
  makePhoneCall: function (event) {
    wx.makePhoneCall({
      phoneNumber: this.data.phoneNumber,
      success: function () { },
      fail: function () {
        app.showModal({ content: '拨打电话失败' });
      }
    })
    this.closeActionSheet();
  },
  cancelReply: function () {
    this.setData({ showReplyBox: false, replyBoxFocus: false, replyContent: '' });
  },
  submitReply: function () {
    let that = this,
        replyParam = that.data.replyParam,
        replyText = replyParam.text;

    if (/^\s*$/.test(replyText) || !replyText) {
      app.showModal({ content: '请填写回复内容' });
      return;
    }

    if (isSubmiting) {
      return;
    }
    isSubmiting = true;
    
    replyParam.sub_app_id = that.data.franchisee;

    app.sendRequest({
      url: '/index.php?r=AppSNS/AddComment',
      data: replyParam,
      method: 'post',
      success: function (res) {
        app.showToast({
          title: '回复成功',
          success: function () {
            that.setData({ showReplyBox: false, replyBoxFocus:false, replyContent: '' });
            delete that.data.replyParam;
          }
        });
        app.globalData.communityDetailRefresh = true;
        app.globalData.communityUsercenterRefresh = true;
        app.globalData.topicRefresh = true;
        app.globalData.franchiseeCommunity = true;
        setTimeout(() => {
          that.onShow();
        }, 1000);
      },
      complete: function (res) {
        isSubmiting = false;
      }
    });
  },
  replyInput: function (event) {
    this.setData({
      'replyParam.text': event.detail.value
    });
  },
  openWXMap: function () {
    let articleInfo = this.data.articleInfo;
    app.openLocation({
      latitude: +articleInfo.latitude,
      longitude: +articleInfo.longitude,
      address: articleInfo.address
    });
  },
  countReadCount: function (articleId) {
    app.sendRequest({
      url: '/index.php?r=AppSNS/CountReadCount',
      method: 'get',
      data: {
        article_id: articleId || this.data.communityId,
        sub_app_id: this.data.franchisee
      },
      success: function () {}
    })
  },
  replyFocus: function (e) {
    if (e.detail.height && e.detail.height != kbHeight) {
      let curKbHeight = e.detail.height;
      kbHeight = e.detail.height;
      if (/iPhone\s?X/i.test(app.globalData.systemInfo.model)) {
        curKbHeight = 365;
      }
      this.setData({
        'replyBoxFocus': true,
        'keyboardHeight': curKbHeight + 'px'
      });
      return;
    }
    this.setData({'replyBoxFocus': true});
  },
  replyBlur: function (e) {
    this.setData({'replyBoxFocus': false});
  },
  createAudioPlayer(article) {
    const innerAudioContext = wx.createInnerAudioContext();
    this.innerAudioContext = innerAudioContext;
    innerAudioContext.src = article.audio_url;
    innerAudioContext.onCanplay(() => {
      this.setData({
        'innerAudioContext.canPlay': true,
        'innerAudioContext.duration': article.duration || 0
      });
    });
    innerAudioContext.onError((res) => {
      app.showModal({content: res.errCode+ ":" +res.errMsg});
    });
  },
  audioPlayAct: function () {
    if (!this.data.innerAudioContext.canPlay) {
      return;
    }
    this.audioTimer && clearInterval(this.audioTimer);
    if (this.data.innerAudioContext.play) {
      this.setData({
        'innerAudioContext.play': false,
        'innerAudioContext.currentTime': this.innerAudioContext.currentTime
      });
      this.innerAudioContext.pause();
      return;
    }
    this.innerAudioContext.play();
    this.audioTimer = setInterval(() => {
      this.setData({
        'innerAudioContext.play': true,
        'innerAudioContext.currentTime': this.innerAudioContext.currentTime
      });
      if (!this.data.innerAudioContext.duration) {
        this.setData({
          'innerAudioContext.duration': this.innerAudioContext.duration
        });
      }
    }, 1000);
  },
  getCurVideoUrl: function (url) {
    let that = this;
    app.sendRequest({
      url: '/index.php?r=AppNews/GetVideoUrl',
      data: { argv: url },
      success: function (res) {
        that.setData({
          'articleInfo.content.url.video.url': res.data
        })
      }
    });
  }
})
