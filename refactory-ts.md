- destruct 语法错误
- `nodejs-cos-sdk-v5`
    - 接口不一样，但是用老接口可正常工作
    - 错误结构体变化，需要做一层转换 (`code` to `Code`)
- 重构时拼写错误
    - 多一个 s
- 尽量不要修改功能
    - 为了适应其他库接口，修改后，和原来的不一样
    - 通过 any 强行传入

- `apigw`
    - 换为 js 后可以通过

    ```ts
        let apiDetail: {
      Method: string;
      Path: string;
      ApiId: string;
      InternalDomain: string;
    } | null = {}; // 错误
    ```