import swaggerUi from 'swagger-ui-express';

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: '共鸣阅读 API',
    version: '0.1.0',
    description: '跨文档协同批注平台 - 评论跟着内容走',
    contact: {
      name: 'GitHub',
      url: 'https://github.com/zychenforfuture/reading-social',
    },
  },
  servers: [
    {
      url: process.env.API_URL || 'http://localhost:3000',
      description: '开发环境',
    },
    ...(process.env.FRONTEND_URL
      ? [{ url: process.env.FRONTEND_URL.replace(/^https?:\/\//, 'http://') + '/api', description: '生产环境' }]
      : []),
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: '登录后使用返回的 token，格式：Bearer <token>',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          username: { type: 'string' },
          avatar_url: { type: 'string', nullable: true },
          is_admin: { type: 'boolean' },
        },
      },
      Document: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          word_count: { type: 'integer' },
          block_count: { type: 'integer' },
          status: { type: 'string', enum: ['processing', 'ready', 'error'] },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
          uploader: { type: 'string', description: '仅管理员可见' },
        },
      },
      Comment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          block_hash: { type: 'string' },
          user_id: { type: 'string', format: 'uuid' },
          content: { type: 'string' },
          username: { type: 'string' },
          avatar_url: { type: 'string' },
          selected_text: { type: 'string' },
          is_resolved: { type: 'boolean' },
          like_count: { type: 'integer' },
          liked_by_me: { type: 'boolean' },
          reply_count: { type: 'integer' },
          root_id: { type: 'string', format: 'uuid' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/auth/send-code': {
      post: {
        tags: ['认证'],
        summary: '发送验证码',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'purpose'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  purpose: { type: 'string', enum: ['register', 'reset_password'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: '验证码已发送' },
          '400': { description: '请求参数错误' },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['认证'],
        summary: '注册账号',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'username', 'password', 'code'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  username: { type: 'string', minLength: 2, maxLength: 50 },
                  password: { type: 'string', minLength: 6 },
                  code: { type: 'string', length: 6 },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: '注册成功' },
          '400': { description: '验证码错误或邮箱已注册' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['认证'],
        summary: '登录',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: '登录成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string', description: 'JWT token，有效期 7 天' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          '401': { description: '账号或密码错误' },
          '403': { description: '邮箱未验证' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['认证'],
        summary: '获取当前用户信息',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: '用户信息',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          '401': { description: '未授权' },
        },
      },
    },
    '/documents': {
      get: {
        tags: ['文档'],
        summary: '获取文档列表',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: '文档列表',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    documents: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Document' },
                    },
                  },
                },
              },
            },
          },
          '401': { description: '未授权' },
        },
      },
      post: {
        tags: ['文档'],
        summary: '上传文档',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'content'],
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: '文档已上传',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    document: { $ref: '#/components/schemas/Document' },
                  },
                },
              },
            },
          },
          '401': { description: '未授权' },
        },
      },
    },
    '/documents/{id}': {
      get: {
        tags: ['文档'],
        summary: '获取文档内容',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0 },
            description: '分页偏移量',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 2000, maximum: 5000 },
            description: '每页数量',
          },
        ],
        responses: {
          '200': { description: '文档内容' },
          '404': { description: '文档不存在' },
        },
      },
      delete: {
        tags: ['文档'],
        summary: '删除文档',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': { description: '删除成功' },
          '403': { description: '无权限删除他人文档' },
          '404': { description: '文档不存在' },
        },
      },
    },
    '/documents/{id}/comments': {
      get: {
        tags: ['评论'],
        summary: '获取文档评论分布',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': { description: '评论列表' },
        },
      },
    },
    '/comments': {
      post: {
        tags: ['评论'],
        summary: '创建评论/回复',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content'],
                properties: {
                  content: { type: 'string' },
                  blockHash: { type: 'string', description: '根评论必填' },
                  rootId: { type: 'string', format: 'uuid', description: '回复时必填' },
                  replyToUserId: { type: 'string', format: 'uuid' },
                  selectedText: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: '评论创建成功' },
          '401': { description: '未授权' },
        },
      },
    },
    '/comments/{id}': {
      patch: {
        tags: ['评论'],
        summary: '更新评论',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                  isResolved: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: '更新成功' },
          '403': { description: '无权限修改他人评论' },
        },
      },
      delete: {
        tags: ['评论'],
        summary: '删除评论',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': { description: '删除成功' },
          '403': { description: '无权限删除他人评论' },
        },
      },
    },
    '/comments/{id}/like': {
      post: {
        tags: ['评论'],
        summary: '点赞/取消点赞',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: '操作成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    liked: { type: 'boolean' },
                    likeCount: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/profile': {
      put: {
        tags: ['用户'],
        summary: '更新个人资料',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['avatar_url'],
                properties: {
                  avatar_url: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: '更新成功' },
        },
      },
    },
    '/auth/change-password': {
      put: {
        tags: ['用户'],
        summary: '修改密码',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['oldPassword', 'newPassword'],
                properties: {
                  oldPassword: { type: 'string' },
                  newPassword: { type: 'string', minLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: '修改成功' },
          '400': { description: '原密码错误' },
        },
      },
    },
  },
};

export { swaggerUi, swaggerSpec };
