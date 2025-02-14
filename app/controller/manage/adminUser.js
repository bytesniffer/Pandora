/*
 * @Author: doramart
 * @Date: 2019-06-20 18:55:40
 * @Last Modified by: doramart
 * @Last Modified time: 2021-03-10 22:47:24
 */
const Controller = require("egg").Controller;
const { adminUserRule } = require("@validate");
const { siteFunc } = require("@utils");
const fs = require("fs");

const { validatorUtil } = require("@utils");

const path = require("path");
const _ = require("lodash");

class AdminUserController extends Controller {
  async list() {
    const { ctx, service } = this;
    try {
      let payload = ctx.query;
      let adminUserList = await ctx.service.adminUser.find(payload, {
        query: {
          state: "1",
        },
        include: [
          {
            as: "group",
            select: "name id",
            model: "AdminGroup",
          },
        ],
        attributes: {
          exclude: ["password"],
        },
      });

      ctx.helper.renderSuccess(ctx, {
        data: adminUserList,
      });
    } catch (err) {
      ctx.helper.renderFail(ctx, {
        message: err,
      });
    }
  }

  async logOutAction() {
    let ctx = this.ctx;
    ctx.session = null;
    ctx.cookies.set("admin_" + this.app.config.auth_cookie_name, null);
    ctx.cookies.set("admin_doracmsapi", null);
    ctx.helper.renderSuccess(ctx);
  }

  async create() {
    const { ctx, service } = this;
    try {
      let fields = ctx.request.body || {};
      const formObj = {
        userName: fields.userName,
        name: fields.name,
        email: fields.email,
        phoneNum: fields.phoneNum,
        countryCode: fields.countryCode,
        password: fields.password,
        confirm: fields.confirm,
        group_id: fields.group_id,
        enable: fields.enable,
        comments: fields.comments,
      };

      ctx.validate(adminUserRule.form(ctx), formObj);

      let oldItem = await ctx.service.adminUser.item({
        query: {
          userName: fields.userName,
        },
      });

      if (!_.isEmpty(oldItem)) {
        throw new Error(ctx.__("validate_hadUse_userName"));
      }

      await ctx.service.adminUser.create(formObj);

      ctx.helper.renderSuccess(ctx);
    } catch (err) {
      ctx.helper.renderFail(ctx, {
        message: err,
      });
    }
  }

  async getOne() {
    const { ctx, service } = this;
    try {
      let id = ctx.query.id;
      let password = ctx.query.password;
      let queryObj = {
        id,
      };

      if (password) {
        _.assign(queryObj, {
          password,
        });
      }

      let targetItem = await ctx.service.adminUser.item({
        query: queryObj,
        attributes: {
          exclude: ["password"],
        },
      });

      ctx.helper.renderSuccess(ctx, {
        data: targetItem,
      });
    } catch (err) {
      ctx.helper.renderFail(ctx, {
        message: err,
      });
    }
  }

  async update() {
    const { ctx, service } = this;
    try {
      let fields = ctx.request.body || {};
      const formObj = {
        userName: fields.userName,
        name: fields.name,
        email: fields.email,
        logo: fields.logo,
        phoneNum: fields.phoneNum,
        countryCode: fields.countryCode,
        group_id: fields.group_id,
        enable: fields.enable,
        comments: fields.comments,
      };

      ctx.validate(adminUserRule.form(ctx), formObj);

      // 单独判断密码
      if (fields.password) {
        if (!validatorUtil.checkPwd(fields.password)) {
          errInfo = ctx.__("validate_inputCorrect", [ctx.__("label_password")]);
        } else {
          formObj.password = fields.password;
        }
      }

      let oldResource = await ctx.service.adminUser.item({
        query: {
          userName: fields.userName,
        },
      });

      if (!_.isEmpty(oldResource) && oldResource.id != fields.id) {
        throw new Error(ctx.__("validate_hadUse_userName"));
      }

      await ctx.service.adminUser.update(fields.id, formObj);

      ctx.helper.renderSuccess(ctx);
    } catch (err) {
      ctx.helper.renderFail(ctx, {
        message: err,
      });
    }
  }

  async removes() {
    const { ctx, app } = this;
    try {
      let targetId = ctx.query.ids;
      // TODO 目前只针对删除单一管理员逻辑
      let oldUser = await ctx.service.adminUser.item({
        query: {
          id: targetId,
        },
      });
      let leftAdminUser = await ctx.service.adminUser.count();
      if (!_.isEmpty(oldUser)) {
        if (oldUser.id === ctx.session.adminUserInfo.id || leftAdminUser == 1) {
          throw new Error("当前场景不允许删除该管理员用户");
        }
      } else {
        throw new Error(ctx.__("validate_error_params"));
      }
      await ctx.service.adminUser.removes(targetId);
      ctx.helper.renderSuccess(ctx);
    } catch (err) {
      ctx.helper.renderFail(ctx, {
        message: err,
      });
    }
  }

  async getBasicSiteInfo() {
    const { ctx, app } = this;
    try {
      let { plugins } = app.getExtendApiList();

      let adminUserCount = 0,
        regUserCount = 0,
        contentCount = 0,
        messageCount = 0,
        messages = [],
        regUsers = [],
        loginLogs = [];

      adminUserCount = await ctx.service.adminUser.count({
        state: "1",
      });

      if (!_.isEmpty(ctx.service.user)) {
        regUserCount = await ctx.service.user.count({
          state: "1",
        });

        regUsers = await ctx.service.user.find(
          {
            isPaging: "0",
            pageSize: 10,
          },
          {
            attributes: {
              exclude: ["email"],
            },
          }
        );
      }

      if (!_.isEmpty(ctx.service.content)) {
        contentCount = await ctx.service.content.count({
          state: "2",
        });
      }
      if (!_.isEmpty(ctx.service.message)) {
        messageCount = await ctx.service.message.count();
        messages = await ctx.service.message.find({
          isPaging: "0",
          pageSize: 8,
        });
      }

      let reKey = new RegExp(ctx.session.adminUserInfo.userName, "i");

      loginLogs = [];
      // TODO 作为插件需要优先判断是否存在
      if (!_.isEmpty(ctx.service.systemOptionLog)) {
        loginLogs = await ctx.service.systemOptionLog.find(
          {
            isPaging: "0",
            pageSize: 1,
          },
          {
            query: {
              log_type: "login",
              logs: {
                [app.Sequelize.Op.like]: `%${reKey}%`,
              },
            },
          }
        );
      }

      // 权限标记
      let fullResources = await ctx.service.adminResource.find({
        isPaging: "0",
      });
      let newResources = [];
      for (let i = 0; i < fullResources.length; i++) {
        let resourceObj = JSON.parse(JSON.stringify(fullResources[i]));
        if (
          resourceObj.source_type == "1" &&
          !_.isEmpty(ctx.session.adminUserInfo)
        ) {
          let adminPower = await ctx.helper.getAdminPower(ctx);
          const adminPowerArr = adminPower.split(",");

          if (adminPowerArr.indexOf(String(resourceObj.id)) > -1) {
            resourceObj.hasPower = true;
          } else {
            resourceObj.hasPower = false;
          }
          newResources.push(resourceObj);
        } else {
          newResources.push(resourceObj);
        }
      }
      let renderBasicInfo = {
        adminUserCount,
        regUserCount,
        regUsers,
        contentCount,
        messageCount,
        messages,
        loginLogs,
        resources: newResources,
      };

      ctx.helper.renderSuccess(ctx, {
        data: renderBasicInfo,
      });
    } catch (err) {
      ctx.helper.renderFail(ctx, {
        message: err,
      });
    }
  }

  async getUserSession() {
    const { ctx, service } = this;
    try {
      let noticeCounts = 0;
      if (!_.isEmpty(ctx.service.systemNotify)) {
        noticeCounts = await ctx.service.systemNotify.count({
          admin_userid: ctx.session.adminUserInfo.id,
          isRead: false,
        });
      }

      let adminUserInfo = await ctx.service.adminUser.item({
        query: {
          id: ctx.session.adminUserInfo.id,
        },
        attributes: ["enable", "password", "id", "email", "userName", "logo"],
      });

      let renderData = {
        noticeCounts,
        loginState: true,
        userInfo: adminUserInfo,
      };

      ctx.helper.renderSuccess(ctx, {
        data: renderData,
      });
    } catch (err) {
      ctx.helper.renderFail(ctx, {
        message: err,
      });
    }
  }

  async dashboard() {
    const { ctx } = this;

    let renderMap = [];
    let payload = {
      isPaging: "0",
    };
    _.assign(payload, {
      pageSize: 1000,
    });
    let manageCates = await ctx.service.adminResource.find(payload, {
      attributes: [
        "api",
        "id",
        "label",
        "enable",
        "routePath",
        "parentId",
        "source_type",
        "icon",
        "comments",
      ],
    });
    let adminPower = await ctx.helper.getAdminPower(ctx);
    let currentCates = await siteFunc.renderNoPowerMenus(
      manageCates,
      adminPower,
      false
    );
    if (!_.isEmpty(currentCates)) {
      let powerPathMaps = [];
      for (const cateItem of currentCates) {
        if (cateItem.parentId != 0 && cateItem.enable) {
          powerPathMaps.push(cateItem.routePath);
        }
      }
      // 追加navbar到第一位
      powerPathMaps.splice(0, 0, "dashboard");
      powerPathMaps.splice(0, 0, "navbar");

      for (const pathItem of powerPathMaps) {
        if (this.app.config.env == "local") {
          // 读取本地文件获取调试端口号
          let admin_micro_path = path.join(
            this.app.config.baseDir,
            "backstage"
          );
          let modulePkgPath = `${admin_micro_path}/${pathItem}/package.json`;
          if (fs.existsSync(modulePkgPath)) {
            let modulePkg = require(modulePkgPath);
            let moduleDevInfo = modulePkg["scripts"]["serve"];
            let modulePort = moduleDevInfo.split(" --port ")[1];

            if (this.app.config.dev_modules.indexOf(pathItem) >= 0) {
              renderMap.push({
                name: pathItem,
                path: `${this.app.config.admin_root_path}:${modulePort}/app.js`,
              });
            } else {
              renderMap.push({
                name: pathItem,
                path: `${
                  this.app.config.server_path + this.app.config.static.prefix
                }/${pathItem}/js/app.js`,
              });
            }
          } else {
            renderMap.push({
              name: pathItem,
              path: `${
                this.app.config.origin +
                "/cms/plugins" +
                this.app.config.static.prefix
              }/sadmin/${pathItem}/js/app.js`,
            });
          }
        } else {
          // 已安装的插件优先级最高
          let { plugins } = this.app.getExtendApiList();
          let pluginStr = `dora${
            pathItem.charAt(0).toUpperCase() + pathItem.slice(1)
          }`;

          if (
            plugins.indexOf(pluginStr) >= 0 &&
            this.app.config[pluginStr].adminUrl
          ) {
            let adminUrlItem =
              this.app.config.admin_root_path +
              this.app.config[pluginStr].adminUrl;
            if (adminUrlItem instanceof Array) {
              for (const routerItem of adminUrlItem) {
                renderMap.push({
                  name: routerItem.path,
                  path: routerItem.url,
                });
              }
            } else {
              renderMap.push({
                name: pathItem,
                path: adminUrlItem,
              });
            }
          } else {
            renderMap.push({
              name: pathItem,
              path: `${this.app.config.admin_root_path}/${pathItem}/js/app.js`,
            });
          }
        }
      }
    }

    renderMap = _.uniqWith(renderMap, _.isEqual);
    await ctx.render("manage/index.html", {
      renderMap: renderMap,
      renderMapJson: JSON.stringify(renderMap),
      staticRootPath: this.app.config.static.prefix,
      adminBasePath: this.app.config.admin_base_path,
      appVersion: this.app.config.pkg.version,
      appName: this.app.config.pkg.name,
    });
  }
}

module.exports = AdminUserController;
