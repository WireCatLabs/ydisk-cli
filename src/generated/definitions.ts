// GENERATED. DO NOT EDIT.
// Source: spec/ydisk/, checked against provenance.json
// Run: pnpm generate

import type { SchemaNode } from "@wirecat/cli-base/codegen/runtime"

export const definitions: Readonly<Record<string, SchemaNode>> = {
  AiPhotoEditorCounter: {
    type: "object",
    properties: {
      count: {
        description: "Количество сохранений",
        type: "integer",
        format: "int64",
      },
      max_count: {
        description: "Максимальное количество сохранений",
        type: "integer",
        format: "int64",
      },
      reset_datetime: {
        description: "Дата и время сброса счетчика, timestamp в секундах",
        type: "integer",
        format: "int64",
      },
    },
    required: [],
  },
  CustomRestrictions: {
    type: "object",
    properties: {
      is_filesize_limit_reduced: {
        description: "Признак уменьшенного лимита размера файла.",
        type: "boolean",
      },
      monthly_traffic_limit_bytes: {
        description: "Максимальный месячный трафик на загрузку в байтах.",
        type: "integer",
        format: "int64",
      },
      photostream_photo_filesize_limit_bytes: {
        description: "Максимальный размер фото в автозагрузке в байтах.",
        type: "integer",
        format: "int64",
      },
      photostream_video_filesize_limit_bytes: {
        description: "Максимальный размер видео в автозагрузке в байтах.",
        type: "integer",
        format: "int64",
      },
    },
    required: [],
  },
  Disk: {
    type: "object",
    properties: {
      deletion_restriction_days: {
        description: "Количество дней до удаления файлов после блокировки",
        type: "integer",
        format: "int64",
      },
      disk_size: {
        description: "Используемый объем диска (байт).",
        type: "integer",
        format: "int64",
      },
      file_size_limit_upgrades: {
        description: "Возможные апгрейды максимального размера файла для загрузки.",
        type: "ref",
        ref: "FileSizeLim",
      },
      free_photounlim_end_date: {
        description: "Timestamp ms окончания бесплатного места в фотобезлимите",
        type: "integer",
        format: "int64",
      },
      hide_screenshots_in_photoslice: {
        description: "Настройка скрытия скриншотов у пользователя",
        type: "boolean",
      },
      is_idm_managed_folder_address_access: {
        description: "Признак управления адресным доступом публичным доступом для папок",
        type: "boolean",
      },
      is_idm_managed_public_access: {
        description: "Признак управления адресным доступом публичным доступом для файлов",
        type: "boolean",
      },
      is_legal_entity: {
        description: "Признак принадлежности пользователя к юридическому лицу",
        type: "boolean",
      },
      is_paid: {
        description: "Признак наличия купленного места.",
        type: "boolean",
      },
      is_pro: {
        description: "Признак тарифа Про.",
        type: "boolean",
      },
      is_sync_shared_folder_desktop: {
        description: "Признак синхронизации общего доступа в ПО",
        type: "boolean",
      },
      is_sync_vd_desktop: {
        description: "Признак синхронизации общих дисков в ПО",
        type: "boolean",
      },
      mail_size: {
        description: "Используемый объем почты (байт). Входит в used_space.",
        type: "integer",
        format: "int64",
      },
      max_file_size: {
        description: "Максимальный поддерживаемый размер файла.",
        type: "integer",
        format: "int64",
      },
      monthly_traffic_limit: {
        description: "Максимальный месячный трафик на загрузку.",
        type: "integer",
        format: "int64",
      },
      monthly_traffic_limit_upgrades: {
        description: "Возможные апгрейды максимального месячного трафика на загрузку.",
        type: "ref",
        ref: "UploadTrafficLim",
      },
      paid_max_file_size: {
        description: "Максимальный поддерживаемый размер файла для платного аккаунта.",
        type: "integer",
        format: "int64",
      },
      payment_flow: {
        description: "Признак причастности пользователя к payment_flow",
        type: "boolean",
      },
      photounlim_size: {
        description: "Общий размер файлов в фотобезлимите.",
        type: "integer",
        format: "int64",
      },
      reg_time: {
        description: "Дата регистрации Диска",
        type: "string",
      },
      revision: {
        description: "Текущая ревизия Диска",
        type: "integer",
        format: "int64",
      },
      system_folders: {
        description: "Адреса системных папок в Диске пользователя.",
        type: "ref",
        ref: "SystemFolders",
      },
      total_space: {
        description: "Общий объем хранилища (байт)",
        type: "integer",
        format: "int64",
      },
      trash_size: {
        description: "Общий размер файлов в Корзине (байт). Входит в used_space.",
        type: "integer",
        format: "int64",
      },
      unlimited_autoupload_enabled: {
        description: "Признак включенной безлимитной автозагрузки с мобильных устройств.",
        type: "boolean",
      },
      used_space: {
        description: "Используемый объем хранилища (байт)",
        type: "integer",
        format: "int64",
      },
      user: {
        description: "Владелец Диска",
        type: "ref",
        ref: "User",
      },
      will_be_overdrawn: {
        description: "Признак - будет ли пользователь в овердрафте по достижении free_photounlim_end_date",
        type: "boolean",
      },
    },
    required: [],
  },
  DiskUserBlocked: {
    type: "object",
    properties: {
      description: {
        description: "Техническое описание ошибки",
        type: "string",
      },
      details: {
        description: "Дополнительные детали ошибки",
        type: "object",
        properties: {},
        required: [],
      },
      error: {
        description: "Уникальный код ошибки",
        type: "string",
      },
      login: {
        description: "Логин пользователя",
        type: "string",
      },
      message: {
        description: "Человекочитаемое описание ошибки",
        type: "string",
      },
      uid: {
        description: "uid пользователя",
        type: "integer",
        format: "int64",
      },
    },
    required: ["error", "description", "message"],
  },
  ApiError: {
    type: "object",
    properties: {
      description: {
        description: "Техническое описание ошибки",
        type: "string",
      },
      details: {
        description: "Дополнительные детали ошибки",
        type: "object",
        properties: {},
        required: [],
      },
      error: {
        description: "Уникальный код ошибки",
        type: "string",
      },
      message: {
        description: "Человекочитаемое описание ошибки",
        type: "string",
      },
    },
    required: ["error", "description", "message"],
  },
  FileSizeLim: {
    type: "object",
    properties: {
      paid: {
        description: "Максимальный размер файла для загрузки у платного аккаунта.",
        type: "integer",
        format: "int64",
      },
      pro: {
        description: "Максимальный размер файла для загрузки у платного аккаунта с тарифом про.",
        type: "integer",
        format: "int64",
      },
    },
    required: [],
  },
  SystemFolders: {
    type: "object",
    properties: {
      applications: {
        description: 'Путь к папке "Приложения".',
        type: "string",
      },
      attach: {
        description: 'Путь к папке "Почтовые вложения".',
        type: "string",
      },
      calendar: {
        description: 'Путь к папке "Материалы встреч".',
        type: "string",
      },
      downloads: {
        description: 'Путь к папке "Загрузки".',
        type: "string",
      },
      facebook: {
        description: 'Путь к папке "Социальные сети/Facebook".',
        type: "string",
      },
      google: {
        description: 'Путь к папке "Социальные сети/Google+".',
        type: "string",
      },
      instagram: {
        description: 'Путь к папке "Социальные сети/Instagram".',
        type: "string",
      },
      mailru: {
        description: 'Путь к папке "Социальные сети/Мой Мир".',
        type: "string",
      },
      messenger: {
        description: 'Путь к папке "Файлы Мессенджера".',
        type: "string",
      },
      odnoklassniki: {
        description: 'Путь к папке "Социальные сети/Одноклассники".',
        type: "string",
      },
      photostream: {
        description: 'Путь к папке "Фотокамера".',
        type: "string",
      },
      scans: {
        description: 'Путь к папке "Сканы".',
        type: "string",
      },
      screenshots: {
        description: 'Путь к папке "Скриншоты".',
        type: "string",
      },
      social: {
        description: 'Путь к папке "Социальные сети".',
        type: "string",
      },
      vkontakte: {
        description: 'Путь к папке "Социальные сети/ВКонтакте".',
        type: "string",
      },
    },
    required: [],
  },
  UploadLimitExceededWithDetails: {
    type: "object",
    properties: {
      description: {
        description: "Техническое описание ошибки",
        type: "string",
      },
      details: {
        description: "Дополнительные детали ошибки",
        type: "object",
        properties: {},
        required: [],
      },
      error: {
        description: "Уникальный код ошибки",
        type: "string",
      },
      limit: {
        description: "Значение лимита.",
        type: "integer",
        format: "int64",
      },
      message: {
        description: "Человекочитаемое описание ошибки",
        type: "string",
      },
      reason: {
        description: "Причина срабатывания лимита.",
        type: "string",
      },
    },
    required: ["error", "description", "message"],
  },
  UploadTrafficLim: {
    type: "object",
    properties: {
      pro: {
        description: "Максимальный размер месячного трафика на загрузку у платного аккаунта с тарифом про.",
        type: "integer",
        format: "int64",
      },
    },
    required: [],
  },
  User: {
    type: "object",
    properties: {
      country: {
        description: "Страна",
        type: "string",
      },
      display_name: {
        description: "Отображаемое имя",
        type: "string",
      },
      is_child: {
        description: "Признак того что аккаунт является детским",
        type: "boolean",
      },
      login: {
        description: "Логин",
        type: "string",
      },
      reg_time: {
        description: "Дата регистрации Диска",
        type: "string",
      },
      uid: {
        description: "Идентификатор пользователя",
        type: "string",
      },
    },
    required: [],
  },
  AvailableUntil: {
    type: "object",
    properties: {
      enabled: {
        description: "Признак включенности настройки.",
        type: "boolean",
      },
      value: {
        description: "Время жизни ссылки.",
        type: "integer",
        format: "int64",
      },
    },
    required: ["enabled"],
  },
  CommentIds: {
    type: "object",
    properties: {
      private_resource: {
        description: "Идентификатор комментариев для приватных ресурсов.",
        type: "string",
      },
      public_resource: {
        description: "Идентификатор комментариев для публичных ресурсов.",
        type: "string",
      },
    },
    required: [],
  },
  DeleteResource: {
    type: "object",
    properties: {
      href: {
        description: "URL",
        type: "string",
      },
      method: {
        description: "HTTP-метод",
        type: "string",
      },
      templated: {
        description: "Признак шаблонизированного URL",
        type: "boolean",
      },
    },
    required: [],
  },
  Delta: {
    type: "object",
    properties: {
      change_type: {
        description: "Тип изменения",
        type: "string",
      },
      context: {
        description: "Контекст, в рамках которого произошло изменение",
        type: "ref",
        ref: "DeltaContext",
      },
      discsw_symlink: {
        description: "Disk software symlink",
        type: "string",
      },
      new_path: {
        description: "Новый путь к ресурсу",
        type: "string",
      },
      path: {
        description: "Путь к ресурсу",
        type: "string",
      },
      resource: {
        description: "Ресурс, для которого произошло изменение",
        type: "ref",
        ref: "DeltaResource",
      },
      resource_id: {
        description: "Идентификатор ресурса",
        type: "string",
      },
      revision: {
        description: "Ревизия",
        type: "integer",
        format: "int64",
      },
      share: {
        description: "Информация об общей папке",
        type: "ref",
        ref: "RootShareInfo",
      },
      type: {
        description: "Тип ресурса",
        type: "string",
      },
    },
    required: ["change_type", "type", "path", "resource_id", "revision"],
  },
  DeltaContext: {
    type: "object",
    properties: {
      change_type: {
        description: "Тип изменения",
        type: "string",
      },
      new_path: {
        description: "Новый путь к ресурсу",
        type: "string",
      },
      path: {
        description: "Путь к ресурсу",
        type: "string",
      },
      req_id: {
        description: "Идентификатор запроса или операции",
        type: "string",
      },
      resource_id: {
        description: "Идентификатор ресурса",
        type: "string",
      },
      type: {
        description: "Тип ресурса",
        type: "string",
      },
    },
    required: ["change_type", "req_id", "type", "resource_id", "path", "new_path"],
  },
  DeltaResource: {
    type: "object",
    properties: {
      md5: {
        description: "MD5-хэш",
        type: "string",
      },
      modified: {
        description: "Дата изменения",
        type: "string",
      },
      public_url: {
        description: "Публичный URL",
        type: "string",
      },
      sha256: {
        description: "SHA256-хэш",
        type: "string",
      },
      size: {
        description: "Размер файла",
        type: "integer",
        format: "int64",
      },
    },
    required: ["path", "type", "name", "created", "modified"],
  },
  Deltas: {
    type: "object",
    properties: {
      items: {
        description: "Список изменений",
        type: "array",
        items: {
          type: "ref",
          ref: "Delta",
        },
      },
      iteration_key: {
        type: "string",
      },
      revision: {
        description: "Ревизия Диска",
        type: "integer",
        format: "int64",
      },
    },
    required: ["iteration_key", "revision", "items"],
  },
  ErrorWithData: {
    type: "object",
    properties: {
      data: {
        description: "Данные, передаваемые с ошибкой.",
        type: "object",
        properties: {},
        required: [],
      },
      description: {
        description: "Техническое описание ошибки",
        type: "string",
      },
      details: {
        description: "Дополнительные детали ошибки",
        type: "object",
        properties: {},
        required: [],
      },
      error: {
        description: "Уникальный код ошибки",
        type: "string",
      },
      message: {
        description: "Человекочитаемое описание ошибки",
        type: "string",
      },
    },
    required: ["error", "description", "message"],
  },
  ExclusionsFromGeneratedAlbumsItems: {
    type: "object",
    properties: {
      items: {
        description: "Список исключений из автосгенерированных альбомов.",
        type: "array",
        items: {
          type: "string",
        },
      },
    },
    required: [],
  },
  Exif: {
    type: "object",
    properties: {
      date_time: {
        description: "Дата съёмки.",
        type: "string",
      },
      gps_latitude: {
        description: "Координата съемки (широта).",
        type: "unknown",
      },
      gps_longitude: {
        description: "Координата съемки (долгота).",
        type: "unknown",
      },
    },
    required: [],
  },
  FilesResourceList: {
    type: "object",
    properties: {
      items: {
        description: "Элементы списка",
        type: "array",
        items: {
          type: "ref",
          ref: "Resource",
        },
      },
      limit: {
        description: "Количество элементов на странице",
        type: "integer",
        format: "int64",
      },
      offset: {
        description: "Смещение от начала списка",
        type: "integer",
        format: "int64",
      },
    },
    required: ["items"],
  },
  ImageMetadata: {
    type: "object",
    properties: {
      angle: {
        description: "Угол поворота изображения",
        type: "integer",
        format: "int64",
      },
      beauty: {
        description: "Красивость изображения по компьютерному зрению",
        type: "number",
      },
      height: {
        description: "Ширина",
        type: "integer",
        format: "int64",
      },
      width: {
        description: "Высота",
        type: "integer",
        format: "int64",
      },
    },
    required: [],
  },
  LastUploadedResourceList: {
    type: "object",
    properties: {
      items: {
        description: "Элементы списка",
        type: "array",
        items: {
          type: "ref",
          ref: "Resource",
        },
      },
      limit: {
        description: "Количество элементов на странице",
        type: "integer",
        format: "int64",
      },
    },
    required: ["items"],
  },
  Link: {
    type: "object",
    properties: {
      href: {
        description: "URL",
        type: "string",
      },
      method: {
        description: "HTTP-метод",
        type: "string",
      },
      templated: {
        description: "Признак шаблонизированного URL",
        type: "boolean",
      },
    },
    required: ["method", "href"],
  },
  OfficeOnlineEditorURL: {
    type: "object",
    properties: {
      edit_url: {
        description: "Ссылка на редактирование файла.",
        type: "string",
      },
    },
    required: ["edit_url"],
  },
  OrgId: {
    type: "object",
    properties: {
      enabled: {
        description: "Признак включенности настройки.",
        type: "boolean",
      },
      value: {
        description: "Ограничение на организацию.",
        type: "string",
      },
    },
    required: ["enabled"],
  },
  Password: {
    type: "object",
    properties: {
      enabled: {
        description: "Признак включенности настройки.",
        type: "boolean",
      },
      value: {
        description: "Пароль от ссылки.",
        type: "string",
      },
    },
    required: ["enabled"],
  },
  Preview: {
    type: "object",
    properties: {
      name: {
        description: "Название (размер) превью",
        type: "string",
      },
      url: {
        description: "Ссылка на скачивание превью",
        type: "string",
      },
    },
    required: [],
  },
  PublicResourcesList: {
    type: "object",
    properties: {
      items: {
        description: "Элементы списка",
        type: "array",
        items: {
          type: "ref",
          ref: "Resource",
        },
      },
      limit: {
        description: "Количество элементов на странице",
        type: "integer",
        format: "int64",
      },
      offset: {
        description: "Смещение от начала списка",
        type: "integer",
        format: "int64",
      },
      type: {
        description: "Значение фильтра по типу ресурсов",
        type: "string",
      },
    },
    required: ["items"],
  },
  PublishResource: {
    type: "object",
    properties: {
      public_settings: {
        description: "Настройки адресного доступа.",
        type: "ref",
        ref: "SetPublicSettings",
      },
    },
    required: [],
  },
  Resource: {
    type: "object",
    properties: {
      _embedded: {
        description: "Список вложенных ресурсов",
        type: "ref",
        ref: "ResourceList",
      },
      antivirus_status: {
        description: "Статус проверки антивирусом",
        type: "unknown",
      },
      comment_ids: {
        description: "Идентификаторы комментариев",
        type: "ref",
        ref: "CommentIds",
      },
      created: {
        description: "Дата создания",
        type: "string",
      },
      custom_properties: {
        description: "Пользовательские атрибуты ресурса",
        type: "object",
        properties: {},
        required: [],
      },
      exif: {
        description: "Метаданные медиафайла (EXIF)",
        type: "ref",
        ref: "Exif",
      },
      file: {
        description: "URL для скачивания файла",
        type: "string",
      },
      md5: {
        description: "MD5-хэш",
        type: "string",
      },
      media_type: {
        description: "Определённый Диском тип файла",
        type: "string",
      },
      mime_type: {
        description: "MIME-тип файла",
        type: "string",
      },
      modified: {
        description: "Дата изменения",
        type: "string",
      },
      name: {
        description: "Имя",
        type: "string",
      },
      path: {
        description: "Путь к ресурсу",
        type: "string",
      },
      photoslice_time: {
        description: "Дата создания фото или видео файла",
        type: "string",
      },
      preview: {
        description: "URL превью файла",
        type: "string",
      },
      public_key: {
        description: "Ключ опубликованного ресурса",
        type: "string",
      },
      public_url: {
        description: "Публичный URL",
        type: "string",
      },
      resource_id: {
        description: "Идентификатор ресурса",
        type: "string",
      },
      revision: {
        description: "Ревизия Диска в которой этот ресурс был изменён последний раз",
        type: "integer",
        format: "int64",
      },
      sha256: {
        description: "SHA256-хэш",
        type: "string",
      },
      share: {
        description: "Информация об общей папке",
        type: "ref",
        ref: "ShareInfo",
      },
      size: {
        description: "Размер файла",
        type: "integer",
        format: "int64",
      },
      sizes: {
        description: "Все размеры превью с URL для скачивания",
        type: "array",
        items: {
          type: "ref",
          ref: "Preview",
        },
      },
      type: {
        description: "Тип",
        type: "string",
      },
    },
    required: ["path", "type", "name", "created", "modified"],
  },
  ResourceDimensions: {
    type: "object",
    properties: {
      height: {
        description: "Высота изображения.",
        type: "integer",
        format: "int64",
      },
      width: {
        description: "Ширина изображения.",
        type: "integer",
        format: "int64",
      },
    },
    required: [],
  },
  ResourceList: {
    type: "object",
    properties: {
      items: {
        description: "Элементы списка",
        type: "array",
        items: {
          type: "ref",
          ref: "Resource",
        },
      },
      limit: {
        description: "Количество элементов на странице",
        type: "integer",
        format: "int64",
      },
      offset: {
        description: "Смещение от начала списка",
        type: "integer",
        format: "int64",
      },
      path: {
        description: "Путь к ресурсу, для которого построен список",
        type: "string",
      },
      sort: {
        description: "Поле, по которому отсортирован список",
        type: "string",
      },
      total: {
        description: "Общее количество элементов в списке",
        type: "integer",
        format: "int64",
      },
    },
    required: ["path", "items"],
  },
  ResourcePatch: {
    type: "object",
    properties: {
      custom_properties: {
        description: "Пользовательские атрибуты ресурса",
        type: "object",
        properties: {},
        required: [],
      },
    },
    required: [],
  },
  ResourceUploadLink: {
    type: "object",
    properties: {
      href: {
        description: "URL",
        type: "string",
      },
      method: {
        description: "HTTP-метод",
        type: "string",
      },
      operation_id: {
        description: "Идентификатор операции загрузки файла",
        type: "string",
      },
      templated: {
        description: "Признак шаблонизированного URL",
        type: "boolean",
      },
    },
    required: ["method", "href", "operation_id"],
  },
  ResourceVersion: {
    type: "object",
    properties: {
      can_be_restored: {
        description: "Может ли версия быть восстановлена",
        type: "boolean",
      },
      created: {
        description: "Дата создания",
        type: "string",
      },
      file: {
        description: "URL для скачивания файла",
        type: "string",
      },
      folded_items_iteration_key: {
        description: "iteration_key для получения свернутых версию",
        type: "string",
      },
      id: {
        description: "ID версии",
        type: "string",
      },
      md5: {
        description: "MD5-хэш",
        type: "string",
      },
      platform_created: {
        description: "Название платформы, из которой создали версию",
        type: "string",
      },
      sha256: {
        description: "SHA256-хэш",
        type: "string",
      },
      size: {
        description: "Размер версии (только для бинарных)",
        type: "integer",
        format: "int64",
      },
      type: {
        description: "Тип версии",
        type: "string",
      },
      uid_created: {
        description: "uid пользователя создавшего версию",
        type: "string",
      },
    },
    required: ["id", "type", "uid_created", "platform_created", "can_be_restored", "created"],
  },
  ResourceVersions: {
    type: "object",
    properties: {
      items: {
        description: "Список версий.",
        type: "array",
        items: {
          type: "ref",
          ref: "ResourceVersion",
        },
      },
      iteration_key: {
        description: "Ключ итерирования по списку версий.",
        type: "string",
      },
    },
    required: ["items"],
  },
  RootShareInfo: {
    type: "object",
    properties: {
      is_owned: {
        description: "Признак, что текущий пользователь является владельцем общей папки",
        type: "boolean",
      },
      rights: {
        description: "Права доступа",
        type: "string",
      },
    },
    required: ["rights"],
  },
  SearchResource: {
    type: "object",
    properties: {
      _embedded: {
        description: "Список вложенных ресурсов",
        type: "ref",
        ref: "SearchResource",
      },
      antivirus_status: {
        description: "Статус проверки антивирусом",
        type: "unknown",
      },
      comment_ids: {
        description: "Идентификаторы комментариев",
        type: "ref",
        ref: "CommentIds",
      },
      created: {
        description: "Дата создания",
        type: "string",
      },
      custom_properties: {
        description: "Пользовательские атрибуты ресурса",
        type: "object",
        properties: {},
        required: [],
      },
      exif: {
        description: "Метаданные медиафайла (EXIF)",
        type: "ref",
        ref: "Exif",
      },
      file: {
        description: "URL для скачивания файла",
        type: "string",
      },
      md5: {
        description: "MD5-хэш",
        type: "string",
      },
      media_type: {
        description: "Определённый Диском тип файла",
        type: "string",
      },
      mime_type: {
        description: "MIME-тип файла",
        type: "string",
      },
      modified: {
        description: "Дата изменения",
        type: "string",
      },
      name: {
        description: "Имя",
        type: "string",
      },
      path: {
        description: "Путь к ресурсу",
        type: "string",
      },
      photoslice_time: {
        description: "Дата создания фото или видео файла",
        type: "string",
      },
      preview: {
        description: "URL превью файла",
        type: "string",
      },
      public_key: {
        description: "Ключ опубликованного ресурса",
        type: "string",
      },
      public_url: {
        description: "Публичный URL",
        type: "string",
      },
      resource_id: {
        description: "Идентификатор ресурса",
        type: "string",
      },
      revision: {
        description: "Ревизия Диска в которой этот ресурс был изменён последний раз",
        type: "integer",
        format: "int64",
      },
      search_scope: {
        description: "Механизм индексации документа",
        type: "string",
      },
      sha256: {
        description: "SHA256-хэш",
        type: "string",
      },
      share: {
        description: "Информация об общей папке",
        type: "ref",
        ref: "ShareInfo",
      },
      size: {
        description: "Размер файла",
        type: "integer",
        format: "int64",
      },
      sizes: {
        description: "Все размеры превью с URL для скачивания",
        type: "array",
        items: {
          type: "ref",
          ref: "Preview",
        },
      },
      type: {
        description: "Тип",
        type: "string",
      },
    },
    required: ["path", "type", "name", "created", "modified"],
  },
  SearchResourceList: {
    type: "object",
    properties: {
      items: {
        description: "Элементы списка",
        type: "array",
        items: {
          type: "ref",
          ref: "SearchResource",
        },
      },
      iteration_key: {
        description: "Поле, по которому отсортирован список",
        type: "string",
      },
      limit: {
        description: "Количество элементов на странице",
        type: "integer",
        format: "int64",
      },
      offset: {
        description: "Смещение от начала списка",
        type: "integer",
        format: "int64",
      },
      path: {
        description: "Путь к ресурсу, для которого построен список",
        type: "string",
      },
      sort: {
        description: "Поле, по которому отсортирован список",
        type: "string",
      },
      total: {
        description: "Общее количество элементов в списке",
        type: "integer",
        format: "int64",
      },
    },
    required: ["path", "items"],
  },
  SetPublicSettings: {
    type: "object",
    properties: {
      accesses: {
        description:
          "Массив параметров, которые задают права доступа пользователей к ресурсу. Позволяет задать настройки для разных уровней доступа:\n* общего — внутри организации или для любых пользователей Яндекс 360 для бизнеса;\n* персонального для определенных сотрудников организации;\n* персонального для определенных групп;\n* персонального для определенных подразделений.",
        type: "array",
        items: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      available_until: {
        description: "Время жизни ссылки.",
        type: "integer",
        format: "int64",
      },
      available_until_verbose: {
        description: "Время жизни ссылки.",
        type: "ref",
        ref: "AvailableUntil",
      },
      external_organization_id: {
        description: "Ограничение на организацию.",
        type: "string",
      },
      external_organization_id_verbose: {
        description: "Ограничение на организацию.",
        type: "ref",
        ref: "OrgId",
      },
      password: {
        description: "Пароль от ссылки.",
        type: "string",
      },
      password_verbose: {
        description: "Пароль от ссылки.",
        type: "ref",
        ref: "Password",
      },
      read_only: {
        description: "Признак того, что ссылка доступна только на чтение.",
        type: "boolean",
      },
    },
    required: [],
  },
  ShareInfo: {
    type: "object",
    properties: {
      is_owned: {
        description: "Признак, что текущий пользователь является владельцем общей папки",
        type: "boolean",
      },
      is_root: {
        description: "Признак того, что папка является корневой в группе",
        type: "boolean",
      },
      rights: {
        description: "Права доступа",
        type: "string",
      },
    },
    required: ["rights"],
  },
  ShortInfoResource: {
    type: "object",
    properties: {
      hid: {
        description: "HID файла",
        type: "string",
      },
      md5: {
        description: "MD5-хэш",
        type: "string",
      },
      mime_type: {
        description: "MIME-тип файла",
        type: "string",
      },
      name: {
        description: "Имя",
        type: "string",
      },
      path: {
        description: "Путь к ресурсу",
        type: "string",
      },
      sha256: {
        description: "SHA256-хэш",
        type: "string",
      },
      size: {
        description: "Размер файла",
        type: "integer",
        format: "int64",
      },
      type: {
        description: "Тип",
        type: "string",
      },
    },
    required: ["path", "type", "name"],
  },
  Snapshot: {
    type: "object",
    properties: {
      items: {
        description: "Элементы снепшота",
        type: "array",
        items: {
          type: "ref",
          ref: "SnapshotResource",
        },
      },
      iteration_key: {
        type: "string",
      },
      revision: {
        description: "Ревизия Диска",
        type: "integer",
        format: "int64",
      },
    },
    required: ["revision", "iteration_key"],
  },
  SnapshotIterationKey: {
    type: "object",
    properties: {
      iteration_key: {
        description: "Ключ итерации",
        type: "string",
      },
    },
    required: [],
  },
  SnapshotResource: {
    type: "object",
    properties: {
      md5: {
        description: "MD5-хэш",
        type: "string",
      },
      modified: {
        description: "Дата изменения",
        type: "string",
      },
      path: {
        description: "Путь к ресурсу",
        type: "string",
      },
      public_url: {
        description: "Публичный URL",
        type: "string",
      },
      resource_id: {
        description: "Идентификатор ресурса",
        type: "string",
      },
      revision: {
        description: "Ревизия Диска в которой этот ресурс был изменён последний раз",
        type: "integer",
        format: "int64",
      },
      sha256: {
        description: "SHA256-хэш",
        type: "string",
      },
      share: {
        description: "Информация об общей папке",
        type: "ref",
        ref: "RootShareInfo",
      },
      size: {
        description: "Размер файла",
        type: "integer",
        format: "int64",
      },
      type: {
        description: "Тип",
        type: "string",
      },
    },
    required: ["path", "type", "name", "created", "modified"],
  },
  UploadResource: {
    type: "object",
    properties: {
      operation_link: {
        description: "Ссылка на получение статуса операции.",
        type: "ref",
        ref: "Link",
      },
      upload_link: {
        description: "URL файла.",
        type: "ref",
        ref: "Link",
      },
    },
    required: ["operation_link", "upload_link"],
  },
  VideoMetadata: {
    type: "object",
    properties: {
      duration: {
        description: "Длительность видео в миллисекундах",
        type: "integer",
        format: "int64",
      },
    },
    required: [],
  },
  AddressAccess: {
    type: "object",
    properties: {
      id: {
        description: "Уникальный идентификатор пользователя/группы/подразделения.",
        type: "integer",
        format: "int64",
      },
      macros: {
        description: "Тип макроса.",
        type: "array",
        items: {
          type: "string",
        },
      },
      org_id: {
        description: "Идентификатор организации.",
        type: "integer",
        format: "int64",
      },
      rights: {
        description: "Пермиссии доступа к ресурсу.",
        type: "array",
        items: {
          type: "string",
        },
      },
      type: {
        description: "Уровень пермиссии.",
        type: "string",
        enum: ["macro", "department", "group", "user", "outer_user"],
      },
    },
    required: ["type", "rights"],
  },
  GetAvailableSettings: {
    type: "object",
    properties: {
      address_access_sharing: {
        description: "Использование адресного доступа, возможность шарить",
        type: "string",
      },
      default: {
        description: "Значения по умолчанию",
        type: "array",
        items: {
          type: "string",
        },
      },
      macro_sharing: {
        description: "Использование общего доступа, возможность шарить на внешних пользователей",
        type: "string",
      },
      permissions: {
        description: "Список доступных прав",
        type: "array",
        items: {
          type: "string",
        },
      },
      sharing_restriction: {
        description: "Ограничения на шаринг",
        type: "ref",
        ref: "SharingRestriction",
      },
      use_sharing: {
        description: "Параметр возможности расшарить адресно",
        type: "boolean",
      },
    },
    required: ["permissions", "default"],
  },
  GetPublicSettings: {
    type: "object",
    properties: {
      accesses: {
        description: "Cправочники прав адресного доступа.",
        type: "array",
        items: {
          type: "ref",
          ref: "PublicSettingsAccesses",
        },
      },
      available_until: {
        description: "Время жизни ссылки.",
        type: "integer",
        format: "int64",
      },
    },
    required: [],
  },
  Name: {
    type: "object",
    properties: {
      first: {
        description: "Имя пользователя",
        type: "string",
      },
      last: {
        description: "Фамилия пользователя",
        type: "string",
      },
      middle: {
        description: "Отчество пользователя",
        type: "string",
      },
    },
    required: [],
  },
  PublicResource: {
    type: "object",
    properties: {
      _embedded: {
        description: "Список вложенных ресурсов",
        type: "ref",
        ref: "PublicResourceList",
      },
      antivirus_status: {
        description: "Статус проверки антивирусом",
        type: "unknown",
      },
      comment_ids: {
        description: "Идентификаторы комментариев",
        type: "ref",
        ref: "CommentIds",
      },
      created: {
        description: "Дата создания",
        type: "string",
      },
      exif: {
        description: "Метаданные медиафайла (EXIF)",
        type: "ref",
        ref: "Exif",
      },
      file: {
        description: "URL для скачивания файла",
        type: "string",
      },
      md5: {
        description: "MD5-хэш",
        type: "string",
      },
      media_type: {
        description: "Определённый Диском тип файла",
        type: "string",
      },
      mime_type: {
        description: "MIME-тип файла",
        type: "string",
      },
      modified: {
        description: "Дата изменения",
        type: "string",
      },
      name: {
        description: "Имя",
        type: "string",
      },
      path: {
        description: "Путь опубликованного ресурса",
        type: "string",
      },
      photoslice_time: {
        description: "Дата создания фото или видео файла",
        type: "string",
      },
      preview: {
        description: "URL превью файла",
        type: "string",
      },
      public_key: {
        description: "Ключ опубликованного ресурса",
        type: "string",
      },
      public_url: {
        description: "Публичный URL",
        type: "string",
      },
      resource_id: {
        description: "Идентификатор ресурса",
        type: "string",
      },
      revision: {
        description: "Ревизия Диска в которой этот ресурс был изменён последний раз",
        type: "integer",
        format: "int64",
      },
      sha256: {
        description: "SHA256-хэш",
        type: "string",
      },
      share: {
        description: "Информация об общей папке",
        type: "ref",
        ref: "ShareInfo",
      },
      size: {
        description: "Размер файла",
        type: "integer",
        format: "int64",
      },
      sizes: {
        description: "Все размеры превью с URL для скачивания",
        type: "array",
        items: {
          type: "ref",
          ref: "Preview",
        },
      },
      type: {
        description: "Тип",
        type: "string",
      },
      views_count: {
        description: "Счетчик просмотров публичного ресурса",
        type: "integer",
        format: "int64",
      },
    },
    required: ["path", "type", "name", "created", "modified", "public_key"],
  },
  PublicResourceList: {
    type: "object",
    properties: {
      items: {
        description: "Элементы списка",
        type: "array",
        items: {
          type: "ref",
          ref: "PublicResource",
        },
      },
      limit: {
        description: "Количество элементов на странице",
        type: "integer",
        format: "int64",
      },
      offset: {
        description: "Смещение от начала списка",
        type: "integer",
        format: "int64",
      },
      path: {
        description: "Путь опубликованного ресурса",
        type: "string",
      },
      public_key: {
        description: "Ключ опубликованного ресурса",
        type: "string",
      },
      sort: {
        description: "Поле, по которому отсортирован список",
        type: "string",
      },
      total: {
        description: "Общее количество элементов в списке",
        type: "integer",
        format: "int64",
      },
    },
    required: ["path", "items", "public_key"],
  },
  PublicSettingsAccesses: {
    type: "object",
    properties: {
      id: {
        description: "ID доступа.",
        type: "integer",
        format: "int64",
      },
      macros: {
        description: "Тип макроса.",
        type: "array",
        items: {
          type: "string",
        },
      },
      org_id: {
        description: "ID организации.",
        type: "integer",
        format: "int64",
      },
      rights: {
        description: "Список прав адресного доступа.",
        type: "array",
        items: {
          type: "string",
        },
      },
      type: {
        description: "Уровень доступа.",
        type: "string",
      },
    },
    required: ["macros", "rights"],
  },
  SharingRestriction: {
    type: "object",
    properties: {
      address_access_sharing: {
        description: "Разрешение предоставлять адресный доступ",
        type: "string",
        enum: ["all", "deny"],
      },
      address_access_sharing_outer: {
        description: "Разрешение предоставлять адресный доступ наружу",
        type: "string",
        enum: ["all", "employees"],
      },
      public_sharing: {
        description: "Разрешение предоставлять общий доступ",
        type: "string",
        enum: ["all", "deny"],
      },
      public_sharing_outer: {
        description: "Разрешение предоставлять общий доступ наружу",
        type: "string",
        enum: ["all", "employees"],
      },
    },
    required: ["public_sharing", "public_sharing_outer", "address_access_sharing", "address_access_sharing_outer"],
  },
  UpdatePublicSettings: {
    type: "object",
    properties: {
      accesses: {
        description: "Список настроек адресного доступа.",
        type: "array",
        items: {
          type: "ref",
          ref: "AddressAccess",
        },
      },
      available_until: {
        description: "Время жизни ссылки.",
        type: "integer",
        format: "int64",
      },
      password: {
        description: "Пароль от ссылки.",
        type: "string",
      },
    },
    required: [],
  },
  UserPublicInformation: {
    type: "object",
    properties: {
      display_name: {
        description: "Отображаемое имя пользователя.",
        type: "string",
      },
      login: {
        description: "Логин.",
        type: "string",
      },
      uid: {
        description: "Идентификатор пользователя.",
        type: "string",
      },
    },
    required: [],
  },
  TrashResource: {
    type: "object",
    properties: {
      _embedded: {
        description: "Список вложенных ресурсов",
        type: "ref",
        ref: "TrashResourceList",
      },
      antivirus_status: {
        description: "Статус проверки антивирусом",
        type: "unknown",
      },
      comment_ids: {
        description: "Идентификаторы комментариев",
        type: "ref",
        ref: "CommentIds",
      },
      created: {
        description: "Дата создания",
        type: "string",
      },
      custom_properties: {
        description: "Пользовательские атрибуты ресурса",
        type: "object",
        properties: {},
        required: [],
      },
      deleted: {
        description: "Дата добавления в корзину(для ресурсов в корзине)",
        type: "string",
      },
      exif: {
        description: "Метаданные медиафайла (EXIF)",
        type: "ref",
        ref: "Exif",
      },
      file: {
        description: "URL для скачивания файла",
        type: "string",
      },
      md5: {
        description: "MD5-хэш",
        type: "string",
      },
      media_type: {
        description: "Определённый Диском тип файла",
        type: "string",
      },
      mime_type: {
        description: "MIME-тип файла",
        type: "string",
      },
      modified: {
        description: "Дата изменения",
        type: "string",
      },
      name: {
        description: "Имя",
        type: "string",
      },
      origin_path: {
        description: "Путь откуда был удалён ресурс",
        type: "string",
      },
      path: {
        description: "Путь к ресурсу",
        type: "string",
      },
      photoslice_time: {
        description: "Дата создания фото или видео файла",
        type: "string",
      },
      preview: {
        description: "URL превью файла",
        type: "string",
      },
      public_key: {
        description: "Ключ опубликованного ресурса",
        type: "string",
      },
      public_url: {
        description: "Публичный URL",
        type: "string",
      },
      resource_id: {
        description: "Идентификатор ресурса",
        type: "string",
      },
      revision: {
        description: "Ревизия Диска в которой этот ресурс был изменён последний раз",
        type: "integer",
        format: "int64",
      },
      sha256: {
        description: "SHA256-хэш",
        type: "string",
      },
      share: {
        description: "Информация об общей папке",
        type: "ref",
        ref: "ShareInfo",
      },
      size: {
        description: "Размер файла",
        type: "integer",
        format: "int64",
      },
      sizes: {
        description: "Все размеры превью с URL для скачивания",
        type: "array",
        items: {
          type: "ref",
          ref: "Preview",
        },
      },
      type: {
        description: "Тип",
        type: "string",
      },
    },
    required: ["path", "type", "name", "created", "modified"],
  },
  TrashResourceList: {
    type: "object",
    properties: {
      items: {
        description: "Элементы списка",
        type: "array",
        items: {
          type: "ref",
          ref: "TrashResource",
        },
      },
      limit: {
        description: "Количество элементов на странице",
        type: "integer",
        format: "int64",
      },
      offset: {
        description: "Смещение от начала списка",
        type: "integer",
        format: "int64",
      },
      path: {
        description: "Путь к ресурсу, для которого построен список",
        type: "string",
      },
      sort: {
        description: "Поле, по которому отсортирован список",
        type: "string",
      },
      total: {
        description: "Общее количество элементов в списке",
        type: "integer",
        format: "int64",
      },
    },
    required: ["path", "items"],
  },
  OperationStatus: {
    type: "object",
    properties: {
      status: {
        description: "Статус операции",
        type: "string",
      },
    },
    required: ["status"],
  },
}
