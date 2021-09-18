/*
 * @Author: doramart 
 * @Date: 2019-09-26 09:19:25 
 * @Last Modified by: doramart
 * @Last Modified time: 2020-08-22 23:58:57
 */
const _ = require('lodash');


let AdsController = {


    async getOne(ctx, app) {

        try {
            let name = ctx.query.name;
            let terminal = ctx.query.terminal;
            if (!name) {
                throw new Error(ctx.__('validate_error_params'));
            }

            let targetItem = await ctx.service.ads.item({
                query: {
                    name: name,
                    state: true
                },
                include: [{
                    as: 'items',
                    model: 'AdsItems'
                }]
            });
            // console.log('one ads', name, JSON.stringify(targetItem))
            let terminalAds = _.filter(targetItem.items, (item) => {
                    // console.log('terminal', item.terminal)
                    return item.terminal == null || item.terminal == terminal;
                });
            // copy
            ads =  JSON.parse(JSON.stringify(targetItem))
            ads['items'] = terminalAds
            // console.log('one ads filter', name, JSON.stringify(ads),'terminal ads', terminalAds)
            ctx.helper.renderSuccess(ctx, {
                data: ads
            });

        } catch (err) {
            ctx.helper.renderFail(ctx, {
                message: err
            });
        }

    }

}

module.exports = AdsController;