import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { CursorConnectionType } from '@ptc-org/nestjs-query-graphql'
import request from 'supertest'
import { DataSource } from 'typeorm'

import { AppModule } from '../src/app.module'
import { SubTaskDTO } from '../src/sub-task/dto/sub-task.dto'
import { refresh } from './fixtures'
import { cursorPageInfoField, edgeNodes, offsetConnection, subTaskFields, todoItemFields } from './graphql-fragments'

describe('SubTaskResolver (limitOffset - e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile()

    app = moduleRef.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        skipMissingProperties: false,
        forbidUnknownValues: true
      })
    )

    await app.init()
    await refresh(app.get(DataSource))
  })

  afterAll(() => refresh(app.get(DataSource)))

  const subTasks = [
    { id: '1', title: 'Create Nest App - Sub Task 1', completed: true, description: null, todoItemId: '1' },
    { id: '2', title: 'Create Nest App - Sub Task 2', completed: false, description: null, todoItemId: '1' },
    { id: '3', title: 'Create Nest App - Sub Task 3', completed: false, description: null, todoItemId: '1' },
    { id: '4', title: 'Create Entity - Sub Task 1', completed: true, description: null, todoItemId: '2' },
    { id: '5', title: 'Create Entity - Sub Task 2', completed: false, description: null, todoItemId: '2' },
    { id: '6', title: 'Create Entity - Sub Task 3', completed: false, description: null, todoItemId: '2' },
    {
      id: '7',
      title: 'Create Entity Service - Sub Task 1',
      completed: true,
      description: null,
      todoItemId: '3'
    },
    {
      id: '8',
      title: 'Create Entity Service - Sub Task 2',
      completed: false,
      description: null,
      todoItemId: '3'
    },
    {
      id: '9',
      title: 'Create Entity Service - Sub Task 3',
      completed: false,
      description: null,
      todoItemId: '3'
    },
    {
      id: '10',
      title: 'Add Todo Item Resolver - Sub Task 1',
      completed: true,
      description: null,
      todoItemId: '4'
    },
    {
      completed: false,
      description: null,
      id: '11',
      title: 'Add Todo Item Resolver - Sub Task 2',
      todoItemId: '4'
    },
    {
      completed: false,
      description: null,
      id: '12',
      title: 'Add Todo Item Resolver - Sub Task 3',
      todoItemId: '4'
    },
    {
      completed: true,
      description: null,
      id: '13',
      title: 'How to create item With Sub Tasks - Sub Task 1',
      todoItemId: '5'
    },
    {
      completed: false,
      description: null,
      id: '14',
      title: 'How to create item With Sub Tasks - Sub Task 2',
      todoItemId: '5'
    },
    {
      completed: false,
      description: null,
      id: '15',
      title: 'How to create item With Sub Tasks - Sub Task 3',
      todoItemId: '5'
    }
  ]

  describe('find one', () => {
    it(`should a sub task by id`, () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `{
          subTask(id: 1) {
            ${subTaskFields}
          }
        }`
        })
        .expect(200)
        .expect({
          data: {
            subTask: {
              id: '1',
              title: 'Create Nest App - Sub Task 1',
              completed: true,
              description: null,
              todoItemId: '1'
            }
          }
        }))

    it(`should throw item not found on non existing sub task`, () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `{
          subTask(id: 100) {
            ${subTaskFields}
          }
        }`
        })
        .expect(200)
        .then(({ body }) => {
          expect(body.errors).toHaveLength(1)
          expect(body.errors[0].message).toContain('Unable to find')
        }))

    it(`should return a todo item`, () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `{
          subTask(id: 1) {
            todoItem {
              ${todoItemFields}
            }
          }
        }`
        })
        .expect(200)
        .expect({
          data: {
            subTask: {
              todoItem: { id: '1', title: 'Create Nest App', completed: true, description: null }
            }
          }
        }))
  })

  describe('query', () => {
    describe('PagingStrategies.NONE', () => {
      it(`should return an array of sub tasks`, () =>
        request(app.getHttpServer())
          .post('/graphql')
          .send({
            operationName: null,
            variables: {},
            query: `{
          subTasks {
           ${subTaskFields}
          }
        }`
          })
          .expect(200)
          .expect({ data: { subTasks } }))

      it(`should allow querying`, () =>
        request(app.getHttpServer())
          .post('/graphql')
          .send({
            operationName: null,
            variables: {},
            query: `{
          subTasks(filter: { id: { in: [1, 2, 3] } }) {
            ${subTaskFields}
          }
        }`
          })
          .expect(200)
          .expect({ data: { subTasks: subTasks.slice(0, 3) } }))

      it(`should allow sorting`, () =>
        request(app.getHttpServer())
          .post('/graphql')
          .send({
            operationName: null,
            variables: {},
            query: `{
          subTasks(sorting: [{field: id, direction: DESC}]) {
           ${subTaskFields}
          }
        }`
          })
          .expect(200)
          .expect({ data: { subTasks: subTasks.slice().reverse() } }))

      describe('paging', () => {
        it(`should not allow paging`, () =>
          request(app.getHttpServer())
            .post('/graphql')
            .send({
              operationName: null,
              variables: {},
              query: `{
          subTasks(paging: {limit: 2}) {
            ${subTaskFields}
          }
        }`
            })
            .expect(400)
            .expect(({ body }) => expect(JSON.stringify(body)).toContain('Unknown argument \\"paging\\"')))
      })
    })
    describe('PagingStrategies.OFFSET', () => {
      it(`should return an array of sub tasks`, () =>
        request(app.getHttpServer())
          .post('/graphql')
          .send({
            operationName: null,
            variables: {},
            query: `{
          subTasksOffset {
           ${offsetConnection(subTaskFields)}
          }
        }`
          })
          .expect(200, {
            data: { subTasksOffset: { nodes: subTasks.slice(0, 10), pageInfo: { hasNextPage: true, hasPreviousPage: false } } }
          }))

      it(`should allow querying`, () =>
        request(app.getHttpServer())
          .post('/graphql')
          .send({
            operationName: null,
            variables: {},
            query: `{
          subTasksOffset(filter: { id: { in: [1, 2, 3] } }) {
            ${offsetConnection(subTaskFields)}
          }
        }`
          })
          .expect(200, {
            data: { subTasksOffset: { nodes: subTasks.slice(0, 3), pageInfo: { hasNextPage: false, hasPreviousPage: false } } }
          }))

      it(`should allow sorting`, () =>
        request(app.getHttpServer())
          .post('/graphql')
          .send({
            operationName: null,
            variables: {},
            query: `{
          subTasksOffset(sorting: [{field: id, direction: DESC}]) {
           ${offsetConnection(subTaskFields)}
          }
        }`
          })
          .expect(200, {
            data: {
              subTasksOffset: {
                nodes: subTasks.slice().reverse().slice(0, 10),
                pageInfo: { hasNextPage: true, hasPreviousPage: false }
              }
            }
          }))

      describe('paging', () => {
        it(`should allow paging with the 'limit' field`, () =>
          request(app.getHttpServer())
            .post('/graphql')
            .send({
              operationName: null,
              variables: {},
              query: `{
          subTasksOffset(paging: {limit: 2}) {
            ${offsetConnection(subTaskFields)}
          }
        }`
            })
            .expect(200, {
              data: {
                subTasksOffset: { nodes: subTasks.slice(0, 2), pageInfo: { hasNextPage: true, hasPreviousPage: false } }
              }
            }))

        it(`should allow paging with the 'limit' field and 'offset'`, () =>
          request(app.getHttpServer())
            .post('/graphql')
            .send({
              operationName: null,
              variables: {},
              query: `{
          subTasksOffset(paging: {limit: 2, offset: 2}) {
            ${offsetConnection(subTaskFields)}
          }
        }`
            })
            .expect(200, {
              data: { subTasksOffset: { nodes: subTasks.slice(2, 4), pageInfo: { hasNextPage: true, hasPreviousPage: true } } }
            }))
      })
    })

    describe('PagingStrategies.CURSOR', () => {
      it(`should return a connection`, () =>
        request(app.getHttpServer())
          .post('/graphql')
          .send({
            operationName: null,
            variables: {},
            query: `{
          subTasksCursor {
            ${cursorPageInfoField}
            ${edgeNodes(subTaskFields)}
          }
        }`
          })
          .expect(200)
          .then(({ body }) => {
            const { edges, pageInfo }: CursorConnectionType<SubTaskDTO> = body.data.subTasksCursor
            expect(pageInfo).toEqual({
              endCursor: 'YXJyYXljb25uZWN0aW9uOjk=',
              hasNextPage: true,
              hasPreviousPage: false,
              startCursor: 'YXJyYXljb25uZWN0aW9uOjA='
            })
            expect(edges).toHaveLength(10)
            expect(edges.map((e) => e.node)).toEqual(subTasks.slice(0, 10))
          }))

      it(`should allow querying`, () =>
        request(app.getHttpServer())
          .post('/graphql')
          .send({
            operationName: null,
            variables: {},
            query: `{
          subTasksCursor(filter: { id: { in: [1, 2, 3] } }) {
            ${cursorPageInfoField}
            ${edgeNodes(subTaskFields)}
          }
        }`
          })
          .expect(200)
          .then(({ body }) => {
            const { edges, pageInfo }: CursorConnectionType<SubTaskDTO> = body.data.subTasksCursor
            expect(pageInfo).toEqual({
              endCursor: 'YXJyYXljb25uZWN0aW9uOjI=',
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: 'YXJyYXljb25uZWN0aW9uOjA='
            })
            expect(edges).toHaveLength(3)
            expect(edges.map((e) => e.node)).toEqual(subTasks.slice(0, 3))
          }))

      it(`should allow sorting`, () =>
        request(app.getHttpServer())
          .post('/graphql')
          .send({
            operationName: null,
            variables: {},
            query: `{
          subTasksCursor(sorting: [{field: id, direction: DESC}]) {
            ${cursorPageInfoField}
            ${edgeNodes(subTaskFields)}
          }
        }`
          })
          .expect(200)
          .then(({ body }) => {
            const { edges, pageInfo }: CursorConnectionType<SubTaskDTO> = body.data.subTasksCursor
            expect(pageInfo).toEqual({
              endCursor: 'YXJyYXljb25uZWN0aW9uOjk=',
              hasNextPage: true,
              hasPreviousPage: false,
              startCursor: 'YXJyYXljb25uZWN0aW9uOjA='
            })
            expect(edges).toHaveLength(10)
            expect(edges.map((e) => e.node)).toEqual(subTasks.slice().reverse().slice(0, 10))
          }))

      describe('paging', () => {
        it(`should allow paging with the 'first' field`, () =>
          request(app.getHttpServer())
            .post('/graphql')
            .send({
              operationName: null,
              variables: {},
              query: `{
          subTasksCursor(paging: {first: 2}) {
            ${cursorPageInfoField}
            ${edgeNodes(subTaskFields)}
          }
        }`
            })
            .expect(200)
            .then(({ body }) => {
              const { edges, pageInfo }: CursorConnectionType<SubTaskDTO> = body.data.subTasksCursor
              expect(pageInfo).toEqual({
                endCursor: 'YXJyYXljb25uZWN0aW9uOjE=',
                hasNextPage: true,
                hasPreviousPage: false,
                startCursor: 'YXJyYXljb25uZWN0aW9uOjA='
              })
              expect(edges).toHaveLength(2)
              expect(edges.map((e) => e.node)).toEqual(subTasks.slice(0, 2))
            }))

        it(`should allow paging with the 'first' field and 'after'`, () =>
          request(app.getHttpServer())
            .post('/graphql')
            .send({
              operationName: null,
              variables: {},
              query: `{
          subTasksCursor(paging: {first: 2, after: "YXJyYXljb25uZWN0aW9uOjE="}) {
            ${cursorPageInfoField}
            ${edgeNodes(subTaskFields)}
          }
        }`
            })
            .expect(200)
            .then(({ body }) => {
              const { edges, pageInfo }: CursorConnectionType<SubTaskDTO> = body.data.subTasksCursor
              expect(pageInfo).toEqual({
                endCursor: 'YXJyYXljb25uZWN0aW9uOjM=',
                hasNextPage: true,
                hasPreviousPage: true,
                startCursor: 'YXJyYXljb25uZWN0aW9uOjI='
              })
              expect(edges).toHaveLength(2)
              expect(edges.map((e) => e.node)).toEqual(subTasks.slice(2, 4))
            }))
      })
    })
  })

  describe('create one', () => {
    it('should allow creating a subTask', () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `mutation {
            createOneSubTask(
              input: {
                subTask: { title: "Test SubTask", completed: false, todoItemId: "1" }
              }
            ) {
              ${subTaskFields}
            }
        }`
        })
        .expect(200, {
          data: {
            createOneSubTask: {
              id: '16',
              title: 'Test SubTask',
              description: null,
              completed: false,
              todoItemId: '1'
            }
          }
        }))

    it('should validate a subTask', () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `mutation {
            createOneSubTask(
              input: {
                subTask: { title: "", completed: false, todoItemId: "1" }
              }
            ) {
              ${subTaskFields}
            }
        }`
        })
        .expect(200)
        .then(({ body }) => {
          expect(body.errors).toHaveLength(1)
          expect(JSON.stringify(body.errors[0])).toContain('title should not be empty')
        }))
  })

  describe('create many', () => {
    it('should allow creating a subTask', () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `mutation {
            createManySubTasks(
              input: {
                subTasks: [
                  { title: "Test Create Many SubTask - 1", completed: false, todoItemId: "2" },
                  { title: "Test Create Many SubTask - 2", completed: true, todoItemId: "2" },
                ]
              }
            ) {
              ${subTaskFields}
            }
        }`
        })
        .expect(200, {
          data: {
            createManySubTasks: [
              { id: '17', title: 'Test Create Many SubTask - 1', description: null, completed: false, todoItemId: '2' },
              { id: '18', title: 'Test Create Many SubTask - 2', description: null, completed: true, todoItemId: '2' }
            ]
          }
        }))

    it('should validate a subTask', () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `mutation {
            createManySubTasks(
              input: {
                subTasks: [{ title: "", completed: false, todoItemId: "2" }]
              }
            ) {
              ${subTaskFields}
            }
        }`
        })
        .expect(200)
        .then(({ body }) => {
          expect(body.errors).toHaveLength(1)
          expect(JSON.stringify(body.errors[0])).toContain('title should not be empty')
        }))
  })

  describe('update one', () => {
    it('should allow updating a subTask', () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `mutation {
            updateOneSubTask(
              input: {
                id: "16",
                update: { title: "Update Test Sub Task", completed: true }
              }
            ) {
              ${subTaskFields}
            }
        }`
        })
        .expect(200, {
          data: {
            updateOneSubTask: {
              id: '16',
              title: 'Update Test Sub Task',
              description: null,
              completed: true,
              todoItemId: '1'
            }
          }
        }))

    it('should require an id', () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `mutation {
            updateOneSubTask(
              input: {
                update: { title: "Update Test Sub Task" }
              }
            ) {
              id
              title
              completed
            }
        }`
        })
        .expect(400)
        .then(({ body }) => {
          expect(body.errors).toHaveLength(1)
          expect(body.errors[0].message).toBe('Field "UpdateOneSubTaskInput.id" of required type "ID!" was not provided.')
        }))

    it('should validate an update', () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `mutation {
            updateOneSubTask(
              input: {
                id: "16",
                update: { title: "" }
              }
            ) {
              id
              title
              completed
            }
        }`
        })
        .expect(200)
        .then(({ body }) => {
          expect(body.errors).toHaveLength(1)
          expect(JSON.stringify(body.errors[0])).toContain('title should not be empty')
        }))
  })

  describe('update many', () => {
    it('should allow updating a subTask', () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `mutation {
            updateManySubTasks(
              input: {
                filter: {id: { in: ["17", "18"]} },
                update: { title: "Update Many Test", completed: true }
              }
            ) {
              updatedCount
            }
        }`
        })
        .expect(200, {
          data: {
            updateManySubTasks: {
              updatedCount: 2
            }
          }
        }))

    it('should require a filter', () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `mutation {
            updateManySubTasks(
              input: {
                update: { title: "Update Many Test", completed: true }
              }
            ) {
              updatedCount
            }
        }`
        })
        .expect(400)
        .then(({ body }) => {
          expect(body.errors).toHaveLength(1)
          expect(body.errors[0].message).toBe(
            'Field "UpdateManySubTasksInput.filter" of required type "SubTaskUpdateFilter!" was not provided.'
          )
        }))

    it('should require a non-empty filter', () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `mutation {
            updateManySubTasks(
              input: {
                filter: { },
                update: { title: "Update Many Test", completed: true }
              }
            ) {
              updatedCount
            }
        }`
        })
        .expect(200)
        .then(({ body }) => {
          expect(body.errors).toHaveLength(1)
          expect(JSON.stringify(body.errors[0])).toContain('filter must be a non-empty object')
        }))
  })

  describe('delete one', () => {
    it('should allow deleting a subTask', () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `mutation {
            deleteOneSubTask(
              input: { id: "16" }
            ) {
              ${subTaskFields}
            }
        }`
        })
        .expect(200, {
          data: {
            deleteOneSubTask: {
              id: null,
              title: 'Update Test Sub Task',
              completed: true,
              description: null,
              todoItemId: '1'
            }
          }
        }))

    it('should require an id', () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `mutation {
            deleteOneSubTask(
              input: { }
            ) {
              ${subTaskFields}
            }
        }`
        })
        .expect(400)
        .then(({ body }) => {
          expect(body.errors).toHaveLength(1)
          expect(body.errors[0].message).toBe('Field "DeleteOneSubTaskInput.id" of required type "ID!" was not provided.')
        }))
  })

  describe('delete many', () => {
    it('should allow updating a subTask', () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `mutation {
            deleteManySubTasks(
              input: {
                filter: {id: { in: ["17", "18"]} },
              }
            ) {
              deletedCount
            }
        }`
        })
        .expect(200, {
          data: {
            deleteManySubTasks: {
              deletedCount: 2
            }
          }
        }))

    it('should require a filter', () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `mutation {
            deleteManySubTasks(
              input: { }
            ) {
              deletedCount
            }
        }`
        })
        .expect(400)
        .then(({ body }) => {
          expect(body.errors).toHaveLength(1)
          expect(body.errors[0].message).toBe(
            'Field "DeleteManySubTasksInput.filter" of required type "SubTaskDeleteFilter!" was not provided.'
          )
        }))

    it('should require a non-empty filter', () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `mutation {
            deleteManySubTasks(
              input: {
                filter: { },
              }
            ) {
              deletedCount
            }
        }`
        })
        .expect(200)
        .then(({ body }) => {
          expect(body.errors).toHaveLength(1)
          expect(JSON.stringify(body.errors[0])).toContain('filter must be a non-empty object')
        }))
  })

  describe('setTodoItemOnSubTask', () => {
    it('should set a the todoItem on a subtask', () =>
      request(app.getHttpServer())
        .post('/graphql')
        .send({
          operationName: null,
          variables: {},
          query: `mutation {
          setTodoItemOnSubTask(input: { id: "1", relationId: "2" }) {
            id
            title
            todoItem {
              ${todoItemFields}
            }
          }
        }`
        })
        .expect(200)
        .expect({
          data: {
            setTodoItemOnSubTask: {
              id: '1',
              title: 'Create Nest App - Sub Task 1',
              todoItem: { id: '2', title: 'Create Entity', completed: false, description: null }
            }
          }
        }))
  })

  afterAll(async () => {
    await app.close()
  })
})
