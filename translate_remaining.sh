#!/bin/bash
cd /Users/phamdung/Documents/oneapi/one-api-main/web/berry/src

# Batch 5: Dashboard & Statistics
find . -name "*.js" -exec sed -i '' \
  -e 's/统计/Statistics/g' \
  -e 's/暂无数据/No data/g' \
  -e 's/无数据/No data/g' \
  -e 's/今日Request量/Today requests/g' \
  -e 's/今日消费/Today usage/g' \
  -e 's/今日 token/Today tokens/g' \
  -e 's/调用次数：/Call count:/g' \
  -e 's/美元/USD/g' \
  {} \;

# Batch 6: Profile & Email
find . -name "*.js" -exec sed -i '' \
  -e 's/Please enter正确的邮箱地址/Please enter a valid email address/g' \
  -e 's/邮箱cannot be empty/Email cannot be empty/g' \
  -e 's/验证码cannot be empty/Verification code cannot be empty/g' \
  -e 's/邮箱账户绑定Success/Email account bound successfully/g' \
  -e 's/Please enter邮箱/Please enter email/g' \
  -e 's/绑定邮箱/Bind email/g' \
  -e 's/重新发送/Resend/g' \
  -e 's/获取验证码/Get verification code/g' \
  -e 's/验证码/Verification code/g' \
  {} \;

# Batch 7: Log types
find . -name "*.js" -exec sed -i '' \
  -e 's/全部/All/g' \
  -e 's/消费/Usage/g' \
  -e 's/管理/Management/g' \
  {} \;

# Batch 8: Settings
find . -name "*.js" -exec sed -i '' \
  -e 's/已是最新Version/Already latest version/g' \
  -e 's/通用Settings/General settings/g' \
  -e 's/检查Update/Check update/g' \
  -e 's/公告/Notice/g' \
  -e 's/在此输入新的公告内容，支持 Markdown & HTML 代码/Enter new notice content, supports Markdown & HTML/g' \
  -e 's/Save公告/Save notice/g' \
  -e 's/个性化Settings/Personalization settings/g' \
  -e 's/在此输入SystemName/Enter system name/g' \
  -e 's/主题Name/Theme name/g' \
  -e 's/Please enter主题Name/Please enter theme name/g' \
  -e 's/Settings主题（重启生效）/Set theme (restart required)/g' \
  -e 's/Logo 图片地址/Logo image URL/g' \
  -e 's/在此输入Logo 图片地址/Enter logo image URL/g' \
  -e 's/首页内容/Homepage content/g' \
  -e 's/Save首页内容/Save homepage content/g' \
  -e 's/关于/About/g' \
  -e 's/Save关于/Save about/g' \
  -e 's/页脚/Footer/g' \
  -e 's/在此输入新的页脚，留空则使用默认页脚，支持 HTML 代码/Enter new footer, leave blank for default, supports HTML/g' \
  -e 's/Settings页脚/Set footer/g' \
  -e 's/去GitHub查看/View on GitHub/g' \
  -e 's/运营Settings/Operation settings/g' \
  -e 's/其他Settings/Other settings/g' \
  {} \;

# Batch 9: Model & Group ratios
find . -name "*.js" -exec sed -i '' \
  -e 's/Model倍率不是合法的 JSON 字符串/Model ratio is not a valid JSON string/g' \
  -e 's/Group倍率不是合法的 JSON 字符串/Group ratio is not a valid JSON string/g' \
  -e 's/补全倍率不是合法的 JSON 字符串/Completion ratio is not a valid JSON string/g' \
  {} \;

# Batch 10: Long Chinese texts in placeholders
find . -name "*.js" -exec sed -i '' \
  -e 's/在此输入首页内容，支持 Markdown & HTML 代码，Settings后首页的Status信息将不再显示。如果输入的是一个链接，则会使用该链接作为 iframe 的 src 属性，这允许你Settings任意网页作为首页。/Enter homepage content, supports Markdown & HTML. After setting, status info will not be displayed. If input is a URL, it will be used as iframe src./g' \
  -e 's/在此输入新的关于内容，支持 Markdown & HTML 代码。如果输入的是一个链接，则会使用该链接作为 iframe 的 src 属性，这允许你Settings任意网页作为关于页面。/Enter new about content, supports Markdown & HTML. If input is a URL, it will be used as iframe src./g' \
  -e 's/移除 One API 的版权标识Must首先获得授权，项目维护需要花费大量精力，如果本项目对你有意义，请主动支持本项目。/Removing One API copyright requires authorization. If this project is meaningful to you, please support it./g' \
  {} \;

echo "All batches complete"
