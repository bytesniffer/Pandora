FROM mhart/alpine-node

LABEL author="doramart@qq.com"

ENV PORT=8080

WORKDIR /app
COPY . /app

RUN ls -l /app
RUN npm install -g cnpm --registry=https://registry.npmmirror.com
RUN cnpm install
RUN cnpm install mammoth node-schedule

EXPOSE ${PORT}


CMD BUILD_ENV=docker npm run dev

