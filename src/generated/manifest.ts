// GENERATED. DO NOT EDIT.
// Source: spec/ydisk/, checked against provenance.json
// Run: pnpm generate

import type {
  ApiServer,
  ManifestOperation,
  SecurityRequirement,
  SecurityScheme,
} from "@wirecat/cli-base/codegen/runtime"

export const operations: readonly ManifestOperation[] = [
  {
    id: "GetDisk",
    command: "disk-get",
    binding: {
      kind: "http",
      method: "GET",
      path: "/v1/disk",
    },
    effect: "read",
    summary: "Получить метаинформацию о диске пользователя",
    description:
      "<p>API возвращает общую информацию о Диске пользователя: доступный объем, адреса системных папок и т. п.</p>",
    tags: ["disk"],
    parameters: [
      {
        name: "extra_fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Дополнительные поля, которые нужно вернуть",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "Disk",
    },
  },
  {
    id: "GetResource",
    command: "resources-list",
    binding: {
      kind: "http",
      method: "GET",
      path: "/v1/disk/resources",
    },
    effect: "read",
    summary: "Получить метаинформацию о файле или каталоге",
    description:
      "<p>Возвращает метаинформацию о файле или каталоге по пути <code>path</code>. Если путь указывает на каталог, в ответе\nтакже описываются ресурсы этого каталога; в поле <code>_embedded</code> приходит список вложенных ресурсов с\nпагинацией. Параметром <code>fields</code> можно ограничить набор возвращаемых атрибутов.</p>",
    tags: ["disk/resources"],
    pagination: {
      style: "offset",
      offset: {
        in: "query",
        name: "offset",
      },
      limit: {
        in: "query",
        name: "limit",
      },
      items: "_embedded.items",
      total: "_embedded.total",
    },
    parameters: [
      {
        name: "path",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Путь к ресурсу.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          format: "int64",
        },
        description: "Количество выводимых вложенных ресурсов.",
      },
      {
        name: "offset",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          format: "int64",
        },
        description: "Смещение от начала списка вложенных ресурсов.",
      },
      {
        name: "preview_crop",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Разрешить обрезку превью.",
      },
      {
        name: "preview_size",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Размер превью.",
      },
      {
        name: "sort",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Поле для сортировки вложенных ресурсов.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "Resource",
    },
  },
  {
    id: "CreateResource",
    command: "resources-create",
    binding: {
      kind: "http",
      method: "PUT",
      path: "/v1/disk/resources",
    },
    effect: "write",
    summary: "Создать каталог",
    description: "<p>Создаёт пустой каталог по пути <code>path</code>. Родительский каталог должен существовать.</p>",
    tags: ["disk/resources"],
    parameters: [
      {
        name: "path",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Путь к создаваемой папке.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "Link",
    },
  },
  {
    id: "UpdateResource",
    command: "resources-update",
    binding: {
      kind: "http",
      method: "PATCH",
      path: "/v1/disk/resources",
    },
    effect: "write",
    summary: "Обновить пользовательские данные ресурса",
    description:
      "<p>Обновляет пользовательские атрибуты ресурса по пути <code>path</code>. Атрибуты передаются в объекте\n<code>custom_properties</code> и добавляются к уже существующим: одноимённые ключи перезаписываются, новые\nдобавляются, а чтобы удалить атрибут, передайте его со значением <code>null</code>.</p>",
    tags: ["disk/resources"],
    parameters: [
      {
        name: "path",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Путь к обновляемому ресурсу.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "ResourcePatch",
    },
    response: {
      confidence: "contract",
      schema: "Resource",
    },
  },
  {
    id: "DeleteResource",
    command: "resources-delete",
    binding: {
      kind: "http",
      method: "DELETE",
      path: "/v1/disk/resources",
    },
    effect: "destructive",
    summary: "Удалить файл или папку",
    description:
      "<p>По умолчанию удалит ресурс в Корзину. Чтобы удалить ресурс не помещая в корзину, следует указать параметр\n<code>permanently=true</code>.</p>\n<p>Если удаление происходит асинхронно, то вернёт ответ со статусом <code>202</code> и ссылкой на асинхронную операцию.\nИначе вернёт ответ со статусом <code>204</code> и пустым телом.</p>",
    tags: ["disk/resources"],
    permissions: [
      {
        key: "files.delete",
      },
    ],
    parameters: [
      {
        name: "path",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Путь к файлу или папке.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
      {
        name: "force_async",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Выполнить асинхронно.",
      },
      {
        name: "md5",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "md5 удаляемого файла.",
      },
      {
        name: "permanently",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Удалить ресурс не помещая в Корзину.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "Link",
    },
  },
  {
    id: "CopyResource",
    command: "resources-copy",
    binding: {
      kind: "http",
      method: "POST",
      path: "/v1/disk/resources/copy",
    },
    effect: "write",
    summary: "Создать копию файла или папки",
    description:
      "<p>Если копирование происходит асинхронно, то вернёт ответ с кодом <code>202</code> и ссылкой на асинхронную операцию.\nИначе вернёт ответ с кодом <code>201</code> и ссылкой на созданный ресурс.</p>",
    tags: ["disk/resources"],
    permissions: [
      {
        key: "files.delete",
        query: ["overwrite"],
      },
    ],
    parameters: [
      {
        name: "from",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Путь к копируемому ресурсу.",
      },
      {
        name: "path",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Путь к создаваемому ресурсу.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
      {
        name: "force_async",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Выполнить асинхронно.",
      },
      {
        name: "overwrite",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Перезаписать существующий ресурс.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "Link",
    },
  },
  {
    id: "GetResourceDownloadLink",
    command: "resources-download-link",
    binding: {
      kind: "http",
      method: "GET",
      path: "/v1/disk/resources/download",
    },
    effect: "read",
    summary: "Получить ссылку на скачивание файла",
    description: "<p>Возвращает временную прямую ссылку для скачивания файла по пути <code>path</code>.</p>",
    tags: ["disk/resources"],
    parameters: [
      {
        name: "path",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Путь к ресурсу.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "Link",
    },
  },
  {
    id: "GetFlatFilesList",
    command: "resources-files-list",
    binding: {
      kind: "http",
      method: "GET",
      path: "/v1/disk/resources/files",
    },
    effect: "read",
    summary: "Получить список файлов упорядоченный по имени",
    tags: ["disk/resources"],
    pagination: {
      style: "offset",
      offset: {
        in: "query",
        name: "offset",
      },
      limit: {
        in: "query",
        name: "limit",
      },
      items: "items",
    },
    parameters: [
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          format: "int64",
        },
        description: "Количество последних загруженных файлов в ответе.",
      },
      {
        name: "media_type",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Фильтр по медиа типу. Несколько типов перечисляются через запятую.",
      },
      {
        name: "offset",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          format: "int64",
        },
        description: "Смещение от начала списка вложенных ресурсов.",
      },
      {
        name: "preview_crop",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Разрешить обрезку превью.",
      },
      {
        name: "preview_size",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Размер превью.",
      },
      {
        name: "sort",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Поле для сортировки ресурсов.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "FilesResourceList",
    },
  },
  {
    id: "GetLastUploadedFilesList",
    command: "resources-last-uploaded-list",
    binding: {
      kind: "http",
      method: "GET",
      path: "/v1/disk/resources/last-uploaded",
    },
    effect: "read",
    summary: "Получить список файлов упорядоченный по дате загрузки",
    description: "<p>Возвращает список последних загруженных файлов, упорядоченный по дате загрузки (по убыванию).</p>",
    tags: ["disk/resources"],
    parameters: [
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          format: "int64",
        },
        description: "Количество последних загруженных файлов в ответе.",
      },
      {
        name: "media_type",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Фильтр по медиа типу. Несколько типов перечисляются через запятую.",
      },
      {
        name: "preview_crop",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Разрешить обрезку превью.",
      },
      {
        name: "preview_size",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Размер превью.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "LastUploadedResourceList",
    },
  },
  {
    id: "MoveResource",
    command: "resources-move",
    binding: {
      kind: "http",
      method: "POST",
      path: "/v1/disk/resources/move",
    },
    effect: "write",
    summary: "Переместить файл или папку",
    description:
      "<p>Если перемещение происходит асинхронно, то вернёт ответ с кодом <code>202</code> и ссылкой на асинхронную операцию.\nИначе вернёт ответ с кодом <code>201</code> и ссылкой на созданный ресурс.</p>",
    tags: ["disk/resources"],
    permissions: [
      {
        key: "files.delete",
        query: ["overwrite"],
      },
    ],
    parameters: [
      {
        name: "from",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Путь к перемещаемому ресурсу.",
      },
      {
        name: "path",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Путь к создаваемому ресурсу.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
      {
        name: "force_async",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Выполнить асинхронно.",
      },
      {
        name: "overwrite",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Перезаписать существующий ресурс.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "Link",
    },
  },
  {
    id: "ListPublicResources",
    command: "resources-public-list",
    binding: {
      kind: "http",
      method: "GET",
      path: "/v1/disk/resources/public",
    },
    effect: "read",
    summary: "Получить список опубликованных ресурсов",
    description: "<p>Возвращает список опубликованных ресурсов пользователя (у которых есть публичная ссылка).</p>",
    tags: ["disk/resources"],
    pagination: {
      style: "offset",
      offset: {
        in: "query",
        name: "offset",
      },
      limit: {
        in: "query",
        name: "limit",
      },
      items: "items",
    },
    parameters: [
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          format: "int64",
        },
        description: "Количество выводимых ресурсов.",
      },
      {
        name: "offset",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          format: "int64",
        },
        description: "Смещение от начала списка ресурсов.",
      },
      {
        name: "preview_crop",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Разрешить обрезку превью.",
      },
      {
        name: "preview_size",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Размер превью.",
      },
      {
        name: "type",
        in: "query",
        required: false,
        schema: {
          type: "string",
          enum: ["file", "dir"],
        },
        description: "Фильтр по типам ресурсов.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "PublicResourcesList",
    },
  },
  {
    id: "PublishResource",
    command: "resources-publish",
    binding: {
      kind: "http",
      method: "PUT",
      path: "/v1/disk/resources/publish",
    },
    effect: "write",
    summary: "Опубликовать ресурс",
    tags: ["disk/resources"],
    permissions: [
      {
        key: "files.share",
      },
    ],
    parameters: [
      {
        name: "path",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Путь к публикуемому ресурсу.",
      },
      {
        name: "allow_address_access",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Возможность клиента обрабатывать ответы от адресного доступа.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "PublishResource",
    },
    response: {
      confidence: "contract",
      schema: "Link",
    },
  },
  {
    id: "UnpublishResource",
    command: "resources-unpublish",
    binding: {
      kind: "http",
      method: "PUT",
      path: "/v1/disk/resources/unpublish",
    },
    effect: "write",
    summary: "Отменить публикацию ресурса",
    tags: ["disk/resources"],
    permissions: [
      {
        key: "files.share",
      },
    ],
    parameters: [
      {
        name: "path",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Путь к ресурсу.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "Link",
    },
  },
  {
    id: "GetResourceUploadLink",
    command: "resources-upload-link",
    binding: {
      kind: "http",
      method: "GET",
      path: "/v1/disk/resources/upload",
    },
    effect: "read",
    summary: "Получить ссылку для загрузки файла",
    description:
      "<p>Возвращает ссылку для загрузки файла на Диск по пути <code>path</code>. Загрузите файл, отправив PUT-запрос с его\nсодержимым на полученный <code>href</code>. Чтобы перезаписать существующий файл, передайте <code>overwrite=true</code>.</p>",
    tags: ["disk/resources"],
    permissions: [
      {
        key: "files.delete",
        query: ["overwrite"],
      },
    ],
    parameters: [
      {
        name: "path",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Путь к загружаемому файлу на Диске.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
      {
        name: "overwrite",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Перезаписать существующий файл.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "ResourceUploadLink",
    },
  },
  {
    id: "UploadExternalResource",
    command: "resources-upload-url",
    binding: {
      kind: "http",
      method: "POST",
      path: "/v1/disk/resources/upload",
    },
    effect: "write",
    summary: "Загрузить файл в Диск по URL",
    description:
      "<p>Загрузка происходит асинхронно. Поэтому в ответ на запрос возвращается ссылка на асинхронную операцию:\nпо ней нужно опрашивать статус, пока он не станет <code>success</code> (файл загружен) или <code>failed</code> (загрузка\nне удалась).</p>",
    tags: ["disk/resources"],
    parameters: [
      {
        name: "path",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Путь, куда будет помещён ресурс.",
      },
      {
        name: "url",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "URL внешнего ресурса, который следует загрузить.",
      },
      {
        name: "disable_redirects",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Запретить делать редиректы.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "Link",
    },
  },
  {
    id: "GetPublicResource",
    command: "public-resources-get",
    binding: {
      kind: "http",
      method: "GET",
      path: "/v1/disk/public/resources",
    },
    effect: "read",
    summary: "Получить метаинформацию о публичном файле или каталоге",
    description:
      "<p>Возвращает метаинформацию об опубликованном файле или каталоге по ключу <code>public_key</code> или публичной ссылке.\nДля каталога в поле <code>_embedded</code> приходит постраничный список вложенных ресурсов: сначала папки, затем\nфайлы, а пути в нём указаны относительно самой опубликованной папки.</p>",
    tags: ["disk/public/resources"],
    pagination: {
      style: "offset",
      offset: {
        in: "query",
        name: "offset",
      },
      limit: {
        in: "query",
        name: "limit",
      },
      items: "_embedded.items",
      total: "_embedded.total",
    },
    parameters: [
      {
        name: "public_key",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Ключ или публичный URL ресурса.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          format: "int64",
        },
        description: "Количество выводимых вложенных ресурсов.",
      },
      {
        name: "offset",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          format: "int64",
        },
        description: "Смещение от начала списка вложенных ресурсов.",
      },
      {
        name: "path",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Путь к ресурсу в публичной папке.",
      },
      {
        name: "preview_crop",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Разрешить обрезку превью.",
      },
      {
        name: "preview_size",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Размер превью.",
      },
      {
        name: "sort",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Поле для сортировки вложенных ресурсов.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "PublicResource",
    },
  },
  {
    id: "GetPublicResourceDownloadLink",
    command: "public-resources-download-link",
    binding: {
      kind: "http",
      method: "GET",
      path: "/v1/disk/public/resources/download",
    },
    effect: "read",
    summary: "Получить ссылку на скачивание публичного ресурса",
    description:
      "<p>Возвращает ссылку для скачивания опубликованного ресурса по ключу <code>public_key</code> или публичной ссылке.\nЧтобы скачать вложенный файл внутри опубликованного каталога, дополнительно укажите <code>path</code> к нему.</p>",
    tags: ["disk/public/resources"],
    parameters: [
      {
        name: "public_key",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Ключ или публичный URL ресурса.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
      {
        name: "path",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Путь к ресурсу в публичной папке.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "Link",
    },
  },
  {
    id: "UpdatePublicSettings",
    command: "public-settings-update",
    binding: {
      kind: "http",
      method: "PATCH",
      path: "/v1/disk/public/resources/public-settings",
    },
    effect: "write",
    summary: "Обновить настройки публичных ссылок",
    tags: ["disk/public/resources"],
    permissions: [
      {
        key: "files.share",
      },
    ],
    parameters: [
      {
        name: "path",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Путь к ресурсу.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
    ],
    request: {
      required: true,
      confidence: "contract",
      schema: "UpdatePublicSettings",
    },
  },
  {
    id: "SaveToDiskPublicResource",
    command: "public-resources-save-to-disk",
    binding: {
      kind: "http",
      method: "POST",
      path: "/v1/disk/public/resources/save-to-disk",
    },
    effect: "write",
    summary: "Сохранить публичный ресурс в папку Загрузки",
    description:
      "<p>Если сохранение происходит асинхронно, то вернёт ответ с кодом <code>202</code> и ссылкой на асинхронную операцию.\nИначе вернёт ответ с кодом <code>201</code> и ссылкой на созданный ресурс.</p>",
    tags: ["disk/public/resources"],
    parameters: [
      {
        name: "public_key",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Ключ или публичный URL ресурса.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
      {
        name: "force_async",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Выполнить асинхронно.",
      },
      {
        name: "name",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Имя, под которым ресурс будет сохранён в папке.",
      },
      {
        name: "path",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Путь к копируемому ресурсу в публичной папке.",
      },
      {
        name: "save_path",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Путь к папке, в которую будет сохранен ресурс. По умолчанию «Загрузки».",
      },
    ],
    response: {
      confidence: "contract",
      schema: "Link",
    },
  },
  {
    id: "GetTrashResource",
    command: "trash-resources-list",
    binding: {
      kind: "http",
      method: "GET",
      path: "/v1/disk/trash/resources",
    },
    effect: "read",
    summary: "Получить содержимое Корзины",
    description:
      "<p>Возвращает содержимое Корзины. Если <code>path</code> не указан, возвращается корень Корзины; для каталога в поле\n<code>_embedded</code> приходит постраничный список вложенных ресурсов. Удалённые ресурсы содержат поле <code>origin_path</code>\n— путь, по которому ресурс находился до удаления.</p>",
    tags: ["disk/trash/resources"],
    pagination: {
      style: "offset",
      offset: {
        in: "query",
        name: "offset",
      },
      limit: {
        in: "query",
        name: "limit",
      },
      items: "_embedded.items",
      total: "_embedded.total",
    },
    parameters: [
      {
        name: "path",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Путь к ресурсу в Корзине.",
      },
      {
        name: "apply_photoslice_filter",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Требуется ли отдавать только фотосрез",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          format: "int64",
        },
        description: "Количество выводимых вложенных ресурсов.",
      },
      {
        name: "offset",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          format: "int64",
        },
        description: "Смещение от начала списка вложенных ресурсов.",
      },
      {
        name: "preview_crop",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Разрешить обрезку превью.",
      },
      {
        name: "preview_size",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Размер превью.",
      },
      {
        name: "sort",
        in: "query",
        required: false,
        schema: {
          type: "string",
          enum: ["deleted", "created", "-deleted", "-created"],
        },
        description: "Поле для сортировки вложенных ресурсов.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "TrashResource",
    },
  },
  {
    id: "ClearTrash",
    command: "trash-resources-delete",
    binding: {
      kind: "http",
      method: "DELETE",
      path: "/v1/disk/trash/resources",
    },
    effect: "destructive",
    summary: "Очистить Корзину",
    description:
      "<p>Если удаление происходит асинхронно, то вернёт ответ со статусом <code>202</code> и ссылкой на асинхронную операцию.\nИначе вернёт ответ со статусом <code>204</code> и пустым телом.</p>\n<p>Если параметр <code>path</code> не задан или указывает на корень Корзины, то корзина будет полностью очищена,\nиначе из Корзины будет удалён только тот ресурс, на который указывает <code>path</code>.</p>",
    tags: ["disk/trash/resources"],
    permissions: [
      {
        key: "files.delete",
      },
    ],
    parameters: [
      {
        name: "apply_photoslice_filter",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Требуется ли удалять только файлы фотосреза",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
      {
        name: "force_async",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Выполнить асинхронно.",
      },
      {
        name: "path",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Путь к ресурсу в Корзине.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "Link",
    },
  },
  {
    id: "RestoreFromTrash",
    command: "trash-resources-restore",
    binding: {
      kind: "http",
      method: "PUT",
      path: "/v1/disk/trash/resources/restore",
    },
    effect: "write",
    summary: "Восстановить ресурс из Корзины",
    description:
      "<p>Восстанавливает ресурс на прежнее место; если родительская папка отсутствует, она создаётся заново.\nВосстановить ресурс под другим именем можно параметром <code>name</code>.\nЕсли восстановление происходит асинхронно, то вернёт ответ с кодом <code>202</code> и ссылкой на асинхронную операцию.\nИначе вернёт ответ с кодом <code>201</code> и ссылкой на созданный ресурс.</p>",
    tags: ["disk/trash/resources"],
    permissions: [
      {
        key: "files.delete",
        query: ["overwrite"],
      },
    ],
    parameters: [
      {
        name: "path",
        in: "query",
        required: true,
        schema: {
          type: "string",
        },
        description: "Путь к ресурсу в Корзине.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
      {
        name: "force_async",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Выполнить асинхронно.",
      },
      {
        name: "name",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Имя, под которым будет восстановлен ресурс.",
      },
      {
        name: "overwrite",
        in: "query",
        required: false,
        schema: {
          type: "boolean",
        },
        description: "Перезаписать существующий ресурс восстанавливаемым.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "Link",
    },
  },
  {
    id: "GetOperationStatus",
    command: "operations-get",
    binding: {
      kind: "http",
      method: "GET",
      path: "/v1/disk/operations/{operation_id}",
    },
    effect: "read",
    summary: "Получить статус асинхронной операции",
    description:
      "<p>Возвращает статус асинхронной операции по её идентификатору <code>operation_id</code>: <code>in-progress</code> — операция\nначата, но ещё не завершена, <code>success</code> — успешно завершена, <code>failed</code> — совершить не удалось,\nпопробуйте повторить изначальный запрос.</p>",
    tags: ["disk/operations/{operation_id}"],
    parameters: [
      {
        name: "operation_id",
        in: "path",
        required: true,
        schema: {
          type: "string",
        },
        description: "Идентификатор операции.",
      },
      {
        name: "fields",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Список возвращаемых атрибутов.",
      },
    ],
    response: {
      confidence: "contract",
      schema: "OperationStatus",
    },
  },
]

export const servers: readonly ApiServer[] = [
  {
    url: "https://cloud-api.yandex.net/",
  },
]

export const securitySchemes: Readonly<Record<string, SecurityScheme>> = {
  oauth: {
    type: "http",
    scheme: "OAuth",
  },
}

export const security: readonly SecurityRequirement[] = [
  {
    oauth: [],
  },
]
